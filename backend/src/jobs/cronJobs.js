const cron = require("node-cron");
const { DateTime, IANAZone } = require("luxon");
const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const { Transaction, User, Fine } = require("../models");
const redis = require("../config/redis");
const notificationService = require("../services/notificationService");
const fineService = require("../services/fineService");
const emailService = require("../services/emailService");
const { runReservationExpiryJob } = require("./reservationExpiryJob");
const { getIO, disconnectUser } = require("../socket");
const DAY = 86400000;
const memberRoles = ["student", "faculty", "public"];
const timezone = () => process.env.LIBRARY_TIMEZONE || "Asia/Karachi";
const local = (now) => DateTime.fromJSDate(now, { zone: timezone() });
const calendarRange = (now, days = 0) => {
  const start = local(now).startOf("day").plus({ days });
  return { $gte: start.toJSDate(), $lt: start.plus({ days: 1 }).toJSDate() };
};
const assertDelivery = (result) => {
  if (
    result?.deliveryStatus === "pending" ||
    result?.deliveryStatus === "failed"
  )
    throw new Error("Notification delivery is pending or failed");
};

const processDueReminders = async (now = new Date()) => {
  const counts = { count3d: 0, count1d: 0 };
  for (const days of [3, 1]) {
    const loans = await Transaction.find({
      status: { $in: ["active", "overdue"] },
      dueDate: calendarRange(now, days),
    })
      .populate("member", "name email")
      .populate("book", "title");
    for (const loan of loans) {
      if (!loan.member) continue;
      assertDelivery(await notificationService.sendDueReminder(loan, days));
      counts[`count${days}d`]++;
    }
  }
  return counts;
};

const processOverdueTransactions = async (now = new Date()) => {
  await fineService.computeOverdueFines(now);
  const loans = await Transaction.find({
    status: { $in: ["active", "overdue"] },
    dueDate: { $lt: now },
  })
    .populate("member", "name email")
    .populate("book", "title");
  let countAlerts = 0;
  for (const loan of loans) {
    if (!loan.member) continue;
    const days = Math.floor((now - new Date(loan.dueDate)) / DAY);
    const milestone = [14, 7, 1].find((value) => days >= value);
    if (milestone) {
      assertDelivery(
        await notificationService.sendOverdueAlert(loan, milestone),
      );
      countAlerts++;
    }
  }
  const io = getIO();
  if (io)
    io.to("role:librarian")
      .to("role:admin")
      .emit("overdue:alert", { count: loans.length, countAlerts });
  return { totalOverdue: loans.length, countAlerts };
};

const processOverdueEscalations = async (now = new Date()) => {
  const cutoff = new Date(now.getTime() - 14 * DAY);
  const staff = await User.find({
    role: { $in: ["librarian", "admin"] },
    isActive: true,
  }).select("name email");
  const loans = await Transaction.find({
    status: { $in: ["active", "overdue"] },
    dueDate: { $lt: cutoff },
  })
    .populate("member", "name email overdueBlocked")
    .populate("book", "title");
  let blockedCount = 0;
  for (const loan of loans) {
    if (!loan.member) continue;
    const session = await mongoose.startSession();
    let changedCount = 0;
    try {
      await session.withTransaction(async () => {
        changedCount = 0;
        const current = await Transaction.exists({
          _id: loan._id,
          status: { $in: ["active", "overdue"] },
          dueDate: { $lt: cutoff },
        }).session(session);
        if (!current) return;
        const changed = await User.updateOne(
          { _id: loan.member._id, overdueBlocked: { $ne: true } },
          { $set: { overdueBlocked: true } },
          { session },
        );
        changedCount = changed.modifiedCount;
        const html = emailService.templates.overdueEscalation(
          loan.member.name,
          loan.book?.title,
          Math.floor((now - new Date(loan.dueDate)) / DAY),
          loan.fineAmount,
        );
        for (const recipient of [loan.member, ...staff]) {
          await notificationService.createNotification({
            userId: recipient,
            type: "account",
            title: "Borrowing Privileges Blocked",
            message: `Borrowing is blocked for member ${loan.member._id} due to a loan more than 14 days overdue.`,
            channels: ["in_app", "email"],
            emailHtml: html,
            session,
            dedupKey: `escalation:${loan._id}:${new Date(loan.dueDate).toISOString()}:${recipient._id}`,
          });
        }
      });
      blockedCount += changedCount;
    } finally {
      await session.endSession();
    }
  }
  const blocked = await User.find({ overdueBlocked: true }).select("_id");
  for (const member of blocked) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const outstanding = await Transaction.exists({
          member: member._id,
          status: { $in: ["active", "overdue"] },
          dueDate: { $lt: cutoff },
        }).session(session);
        if (!outstanding)
          await User.updateOne(
            { _id: member._id, overdueBlocked: true },
            { $set: { overdueBlocked: false } },
            { session },
          );
      });
    } finally {
      await session.endSession();
    }
  }
  const delivery = await notificationService.reconcilePendingDeliveries();
  if (delivery.pending) throw new Error("Escalation delivery remains pending");
  return { blockedCount, totalProcessed: loans.length };
};

const processMembershipExpirations = async (now = new Date()) => {
  let deactivatedCount = 0;
  let noticeCount = 0;
  const expired = await User.find({
    role: { $in: memberRoles },
    isActive: true,
    membershipExpiry: { $lt: now },
  });
  for (const member of expired) {
    const session = await mongoose.startSession();
    let deactivated = false;
    try {
      await session.withTransaction(async () => {
        deactivated = false;
        const result = await User.updateOne(
          {
            _id: member._id,
            isActive: true,
            membershipExpiry: { $lt: now },
            role: { $in: memberRoles },
          },
          { $set: { isActive: false } },
          { session },
        );
        if (!result.modifiedCount) return;
        await notificationService.createNotification({
          userId: member,
          type: "membership_expiry",
          title: "Membership Expired",
          message:
            "Your library membership has expired. Please contact the library to renew.",
          channels: ["in_app", "email"],
          session,
          dedupKey: `membership:${member._id}:${new Date(member.membershipExpiry).toISOString()}:expired`,
        });
        deactivated = true;
      });
      if (deactivated) {
        deactivatedCount++;
        disconnectUser(member._id);
      }
    } finally {
      await session.endSession();
    }
  }
  for (const days of [30, 7]) {
    const members = await User.find({
      role: { $in: memberRoles },
      isActive: true,
      membershipExpiry: calendarRange(now, days),
    });
    for (const member of members) {
      assertDelivery(
        await notificationService.sendMembershipExpiring(member, days),
      );
      noticeCount++;
    }
  }
  const delivery = await notificationService.reconcilePendingDeliveries();
  if (delivery.pending)
    throw new Error("Membership notification delivery remains pending");
  return { deactivatedCount, noticeCount };
};

const generateWeeklyLibraryReport = async (now = new Date()) => {
  const end = local(now).startOf("week");
  const start = end.minus({ weeks: 1 });
  const range = { $gte: start.toJSDate(), $lt: end.toJSDate() };
  const newMembers = await User.countDocuments({
    role: { $in: memberRoles },
    createdAt: range,
  });
  const newIssues = await Transaction.countDocuments({ issueDate: range });
  const sum = async (field, timestamp) => {
    const rows = await Fine.aggregate([
      { $unwind: `$${field}` },
      { $match: { [`${field}.${timestamp}`]: range } },
      { $group: { _id: null, total: { $sum: `$${field}.amount` } } },
    ]);
    return rows[0]?.total ?? 0;
  };
  const finesCollected = await sum("payments", "paidAt");
  const totalFinesAssessed = await sum("assessments", "assessedAt");
  const popular = await Transaction.aggregate([
    { $match: { issueDate: range } },
    { $group: { _id: "$book", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "books",
        localField: "_id",
        foreignField: "_id",
        as: "book",
      },
    },
    { $unwind: "$book" },
  ]);
  const stats = {
    newMembers,
    newIssues,
    finesCollected,
    totalFinesAssessed,
    topBooks: popular.map((item) => ({
      title: item.book.title,
      count: item.count,
    })),
  };
  const admins = await User.find({ role: "admin", isActive: true }).select(
    "name email",
  );
  for (const admin of admins)
    assertDelivery(
      await notificationService.sendWeeklyReport(
        admin,
        stats,
        start.toJSDate(),
      ),
    );
  return {
    success: true,
    stats,
    sentTo: admins.length,
    start: start.toISO(),
    end: end.toISO(),
  };
};

const scheduledJobs = new Map();
const LEASE_MS = 60000;
const renewScript =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end";
const releaseScript =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
let stopping = false;
const runCronJob = async (name) => {
  const entry = scheduledJobs.get(name);
  if (!entry) throw new Error("Unknown scheduled job");
  if (stopping || entry.active) return { skipped: true };
  const { state } = entry;
  const execution = async () => {
    const owner = randomUUID();
    const key = `cron:lease:${name}`;
    let acquired = false;
    let timer;
    let renewal = Promise.resolve();
    let leaseError;
    state.running = true;
    state.lastStartedAt = new Date().toISOString();
    try {
      acquired = (await redis.set(key, owner, "PX", LEASE_MS, "NX")) === "OK";
      if (!acquired) return { skipped: true };
      timer = setInterval(() => {
        renewal = renewal
          .then(async () => {
            if ((await redis.eval(renewScript, 1, key, owner, LEASE_MS)) !== 1)
              leaseError = new Error("Cron lease lost");
          })
          .catch(() => {
            leaseError = new Error("Cron lease renewal failed");
          });
      }, LEASE_MS / 3);
      timer.unref();
      const result = await entry.callback();
      await renewal;
      if (leaseError) throw leaseError;
      state.lastSuccessAt = new Date().toISOString();
      state.lastError = null;
      return result;
    } catch (error) {
      state.lastFailureAt = new Date().toISOString();
      state.lastError = "Job execution failed";
      throw error;
    } finally {
      clearInterval(timer);
      await renewal;
      try {
        if (acquired) await redis.eval(releaseScript, 1, key, owner);
      } catch (error) {
        state.lastFailureAt = new Date().toISOString();
        state.lastError = "Lease release failed";
        throw error;
      } finally {
        state.running = false;
        state.lastFinishedAt = new Date().toISOString();
      }
    }
  };
  entry.active = execution();
  try {
    return await entry.active;
  } finally {
    entry.active = null;
  }
};
const initCronJobs = () => {
  if (scheduledJobs.size) return getCronStatus();
  if (!IANAZone.isValidZone(timezone()))
    throw new Error("Invalid LIBRARY_TIMEZONE");
  stopping = false;
  const definitions = [
    ["dueReminders", "0 8 * * *", processDueReminders],
    ["overdueTransactions", "0 9 * * *", processOverdueTransactions],
    ["overdueEscalations", "0 10 * * *", processOverdueEscalations],
    ["reservationExpiry", "*/30 * * * *", runReservationExpiryJob],
    ["membershipExpirations", "0 23 * * *", processMembershipExpirations],
    ["weeklyLibraryReport", "0 7 * * 1", generateWeeklyLibraryReport],
  ];
  for (const [name, schedule, callback] of definitions) {
    const state = {
      name,
      schedule,
      timezone: timezone(),
      scheduled: false,
      running: false,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
    };
    const task = cron.schedule(
      schedule,
      () =>
        runCronJob(name).catch(() => {
          console.error(
            `[Cron:${name}] Execution failed; inspect administrator job status`,
          );
        }),
      { scheduled: false, timezone: timezone() },
    );
    scheduledJobs.set(name, { task, state, callback, active: null });
  }
  return getCronStatus();
};
const startCronJobs = () => {
  stopping = false;
  for (const { task, state } of scheduledJobs.values()) {
    task.start();
    state.scheduled = true;
  }
  return getCronStatus();
};
const getCronStatus = () =>
  Array.from(scheduledJobs.values(), ({ state }) => ({ ...state }));
const stopCronJobs = async () => {
  stopping = true;
  const active = [];
  for (const { task, state, active: run } of scheduledJobs.values()) {
    task.stop();
    state.scheduled = false;
    if (run) active.push(run);
  }
  await Promise.allSettled(active);
  return getCronStatus();
};
const reconcileStartup = async () => {
  for (const name of [
    "reservationExpiry",
    "overdueTransactions",
    "overdueEscalations",
    "dueReminders",
    "membershipExpirations",
    "weeklyLibraryReport",
  ]) {
    await runCronJob(name);
  }
  return { reconciled: true };
};
module.exports = {
  initCronJobs,
  startCronJobs,
  stopCronJobs,
  getCronStatus,
  runCronJob,
  reconcileStartup,
  calendarRange,
  processDueReminders,
  processOverdueTransactions,
  processOverdueEscalations,
  processMembershipExpirations,
  generateWeeklyLibraryReport,
};
