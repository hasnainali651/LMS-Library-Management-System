const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const {
  User,
  Book,
  Copy,
  Transaction,
  Reservation,
  Fine,
  MembershipType,
  Notification,
  Review,
  AuditLog,
} = require('../models');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/lms_db';
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected for seeder operations.');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
};

const membershipTypesData = [
  {
    name: 'student',
    displayName: 'Student Membership',
    maxBooks: 3,
    loanDays: 14,
    renewalLimit: 2,
    finePerDay: 5,
    maxFinePerBook: 500,
    maxFineBalance: 2000,
    canBorrowReference: false,
    isActive: true,
  },
  {
    name: 'faculty',
    displayName: 'Faculty Membership',
    maxBooks: 10,
    loanDays: 30,
    renewalLimit: 5,
    finePerDay: 3,
    maxFinePerBook: 500,
    maxFineBalance: 2000,
    canBorrowReference: true,
    isActive: true,
  },
  {
    name: 'staff',
    displayName: 'Staff Membership',
    maxBooks: 5,
    loanDays: 21,
    renewalLimit: 3,
    finePerDay: 4,
    maxFinePerBook: 500,
    maxFineBalance: 2000,
    canBorrowReference: false,
    isActive: true,
  },
  {
    name: 'public',
    displayName: 'Public Membership',
    maxBooks: 2,
    loanDays: 7,
    renewalLimit: 1,
    finePerDay: 10,
    maxFinePerBook: 500,
    maxFineBalance: 2000,
    canBorrowReference: false,
    isActive: true,
  },
];

const booksData = [
  {
    isbn: '9780132350884',
    title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
    authors: ['Robert C. Martin'],
    publisher: 'Prentice Hall',
    publishedYear: 2008,
    edition: '1st',
    language: 'English',
    description: 'Even bad code can function. But if code isn\'t clean, it can bring a development organization to its knees.',
    categories: ['Technology'],
    tags: ['programming', 'clean code', 'craftsmanship', 'refactoring'],
    deweyDecimal: '005.1',
    price: 45.0,
  },
  {
    isbn: '9780201633610',
    title: 'Design Patterns: Elements of Reusable Object-Oriented Software',
    authors: ['Erich Gamma', 'Richard Helm', 'Ralph Johnson', 'John Vlissides'],
    publisher: 'Addison-Wesley Professional',
    publishedYear: 1994,
    edition: '1st',
    language: 'English',
    description: 'Capturing a wealth of experience about the design of object-oriented software with 23 classic design patterns.',
    categories: ['Technology'],
    tags: ['oop', 'architecture', 'design patterns'],
    deweyDecimal: '005.12',
    price: 54.0,
  },
  {
    isbn: '9780262033848',
    title: 'Introduction to Algorithms',
    authors: ['Thomas H. Cormen', 'Charles E. Leiserson', 'Ronald L. Rivest', 'Clifford Stein'],
    publisher: 'MIT Press',
    publishedYear: 2009,
    edition: '3rd',
    language: 'English',
    description: 'A comprehensive textbook on modern algorithms covering mathematical rigor and practical efficiency.',
    categories: ['Mathematics', 'Technology'],
    tags: ['algorithms', 'data structures', 'clrs'],
    deweyDecimal: '518.1',
    price: 85.0,
  },
  {
    isbn: '9781449373320',
    title: 'Designing Data-Intensive Applications',
    authors: ['Martin Kleppmann'],
    publisher: "O'Reilly Media",
    publishedYear: 2017,
    edition: '1st',
    language: 'English',
    description: 'The big ideas behind reliable, scalable, and maintainable data systems in modern computing.',
    categories: ['Technology'],
    tags: ['distributed systems', 'databases', 'stream processing'],
    deweyDecimal: '005.74',
    price: 49.99,
  },
  {
    isbn: '9780135957059',
    title: 'The Pragmatic Programmer: Your Journey to Mastery',
    authors: ['David Thomas', 'Andrew Hunt'],
    publisher: 'Addison-Wesley Professional',
    publishedYear: 2019,
    edition: '20th Anniversary Edition',
    language: 'English',
    description: 'Illustrates the best approaches and major pitfalls of many different aspects of software development.',
    categories: ['Technology'],
    tags: ['career', 'best practices', 'programming'],
    deweyDecimal: '005.1',
    price: 48.5,
  },
  {
    isbn: '9780262510875',
    title: 'Structure and Interpretation of Computer Programs',
    authors: ['Harold Abelson', 'Gerald Jay Sussman'],
    publisher: 'MIT Press',
    publishedYear: 1996,
    edition: '2nd',
    language: 'English',
    description: 'Widely known as the Wizard Book in computer science, teaching fundamental principles of abstraction.',
    categories: ['Science', 'Technology'],
    tags: ['sicp', 'scheme', 'computer science'],
    deweyDecimal: '005.13',
    price: 65.0,
  },
  {
    isbn: '9780553380163',
    title: 'A Brief History of Time',
    authors: ['Stephen Hawking'],
    publisher: 'Bantam Books',
    publishedYear: 1988,
    edition: 'Updated',
    language: 'English',
    description: 'A landmark volume in science writing by one of the great minds of our time exploring space and time.',
    categories: ['Science'],
    tags: ['astrophysics', 'cosmology', 'physics'],
    deweyDecimal: '523.1',
    price: 18.0,
  },
  {
    isbn: '9780199291151',
    title: 'The Selfish Gene',
    authors: ['Richard Dawkins'],
    publisher: 'Oxford University Press',
    publishedYear: 2006,
    edition: '30th Anniversary',
    language: 'English',
    description: 'Dawkins explains how natural selection operates at the level of individual genes.',
    categories: ['Science'],
    tags: ['evolution', 'biology', 'genetics'],
    deweyDecimal: '576.5',
    price: 16.5,
  },
  {
    isbn: '9780062316097',
    title: 'Sapiens: A Brief History of Humankind',
    authors: ['Yuval Noah Harari'],
    publisher: 'Harper',
    publishedYear: 2014,
    edition: '1st',
    language: 'English',
    description: 'From a renowned historian comes a groundbreaking narrative of humanity\'s creation and evolution.',
    categories: ['History'],
    tags: ['anthropology', 'humanity', 'world history'],
    deweyDecimal: '909',
    price: 24.99,
  },
  {
    isbn: '9780393317558',
    title: 'Guns, Germs, and Steel: The Fates of Human Societies',
    authors: ['Jared Diamond'],
    publisher: 'W. W. Norton & Company',
    publishedYear: 1999,
    edition: 'Reprint',
    language: 'English',
    description: 'Fascinating assessment of the geographical and environmental factors shaping human history.',
    categories: ['History'],
    tags: ['civilization', 'geography', 'pulitzer'],
    deweyDecimal: '909.08',
    price: 21.0,
  },
  {
    isbn: '9780374533557',
    title: 'Thinking, Fast and Slow',
    authors: ['Daniel Kahneman'],
    publisher: 'Farrar, Straus and Giroux',
    publishedYear: 2011,
    edition: '1st',
    language: 'English',
    description: 'Nobel laureate Daniel Kahneman explains the two systems that drive the way we think and decide.',
    categories: ['Psychology'],
    tags: ['behavioral economics', 'cognitive science', 'decision making'],
    deweyDecimal: '153.4',
    price: 19.99,
  },
  {
    isbn: '9780807014295',
    title: "Man's Search for Meaning",
    authors: ['Viktor E. Frankl'],
    publisher: 'Beacon Press',
    publishedYear: 2006,
    edition: 'Revised',
    language: 'English',
    description: 'Psychiatrist Viktor Frankl discusses logotherapy and finding purpose even in severe suffering.',
    categories: ['Psychology', 'Philosophy'],
    tags: ['logotherapy', 'existentialism', 'inspiration'],
    deweyDecimal: '150.19',
    price: 15.0,
  },
  {
    isbn: '9780140449334',
    title: 'Meditations',
    authors: ['Marcus Aurelius'],
    publisher: 'Penguin Classics',
    publishedYear: 2006,
    edition: 'Translation',
    language: 'English',
    description: 'Private journal notes of the Roman Emperor Marcus Aurelius detailing Stoic philosophy.',
    categories: ['Philosophy'],
    tags: ['stoicism', 'ancient rome', 'ethics'],
    deweyDecimal: '188',
    price: 14.0,
  },
  {
    isbn: '9780140449235',
    title: 'Beyond Good and Evil',
    authors: ['Friedrich Nietzsche'],
    publisher: 'Penguin Classics',
    publishedYear: 2003,
    edition: 'Translation',
    language: 'English',
    description: 'Nietzsche dramatically rejects traditional morality in favor of the will to power.',
    categories: ['Philosophy'],
    tags: ['morality', 'nihilism', 'philosophy'],
    deweyDecimal: '193',
    price: 14.99,
  },
  {
    isbn: '9780061120084',
    title: 'To Kill a Mockingbird',
    authors: ['Harper Lee'],
    publisher: 'Harper Perennial',
    publishedYear: 1960,
    edition: 'Classic',
    language: 'English',
    description: 'Pulitzer Prize-winning masterpiece set in Maycomb, Alabama dealing with racism and empathy.',
    categories: ['Fiction'],
    tags: ['american classic', 'courtroom', 'coming of age'],
    deweyDecimal: '813.54',
    price: 16.99,
  },
  {
    isbn: '9780451524935',
    title: '1984',
    authors: ['George Orwell'],
    publisher: 'Signet Classic',
    publishedYear: 1950,
    edition: 'Mass Market',
    language: 'English',
    description: 'A dystopian vision of totalitarian society ruled by Big Brother and perpetual state surveillance.',
    categories: ['Fiction'],
    tags: ['dystopia', 'totalitarianism', 'classic'],
    deweyDecimal: '823.912',
    price: 12.99,
  },
  {
    isbn: '9780743273565',
    title: 'The Great Gatsby',
    authors: ['F. Scott Fitzgerald'],
    publisher: 'Scribner',
    publishedYear: 1925,
    edition: 'Scribner Classic',
    language: 'English',
    description: 'The exemplary novel of the Jazz Age and the tragic romance of Jay Gatsby.',
    categories: ['Literature', 'Fiction'],
    tags: ['jazz age', 'american dream', 'tragedy'],
    deweyDecimal: '813.52',
    price: 15.0,
  },
  {
    isbn: '9780066620992',
    title: "Good to Great: Why Some Companies Make the Leap and Others Don't",
    authors: ['Jim Collins'],
    publisher: 'HarperBusiness',
    publishedYear: 2001,
    edition: '1st',
    language: 'English',
    description: 'Management book uncovering characteristics of companies that achieved sustained great performance.',
    categories: ['Business'],
    tags: ['leadership', 'management', 'business strategy'],
    deweyDecimal: '658.04',
    price: 32.5,
  },
  {
    isbn: '9780307887894',
    title: 'The Lean Startup',
    authors: ['Eric Ries'],
    publisher: 'Crown Business',
    publishedYear: 2011,
    edition: '1st',
    language: 'English',
    description: 'How modern entrepreneurs use continuous innovation to create radically successful businesses.',
    categories: ['Business'],
    tags: ['entrepreneurship', 'mvp', 'agile business'],
    deweyDecimal: '658.11',
    price: 28.0,
  },
  {
    isbn: '9780071390118',
    title: 'Principles of Neural Science',
    authors: ['Eric R. Kandel', 'James H. Schwartz', 'Thomas M. Jessell'],
    publisher: 'McGraw-Hill Medical',
    publishedYear: 2000,
    edition: '4th',
    language: 'English',
    description: 'The definitive neuroscience text detailing molecular, cellular, and cognitive mechanisms.',
    categories: ['Medicine', 'Science'],
    tags: ['neuroscience', 'brain', 'medical textbook'],
    deweyDecimal: '612.8',
    price: 120.0,
  },
];

const importData = async () => {
  try {
    await connectDB();

    console.log('--- PURGING EXISTING DATABASE COLLECTIONS ---');
    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      Copy.deleteMany({}),
      Transaction.deleteMany({}),
      Reservation.deleteMany({}),
      Fine.deleteMany({}),
      MembershipType.deleteMany({}),
      Notification.deleteMany({}),
      Review.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    console.log('Purged all collections.');

    console.log('\n--- SEEDING 4 MEMBERSHIP TYPES ---');
    const createdMembershipTypes = await MembershipType.insertMany(membershipTypesData);
    console.log(`Seeded ${createdMembershipTypes.length} membership types.`);

    console.log('\n--- SEEDING USERS (1 Admin, 2 Librarians, 1 Student Member) ---');
    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@library.com',
      password: 'Admin@123456',
      role: 'admin',
      membershipType: 'staff',
      isActive: true,
      isEmailVerified: true,
    });

    const librarian1 = await User.create({
      name: 'Sarah Connor',
      email: 'sarah.librarian@library.com',
      password: 'Librarian@123456',
      role: 'librarian',
      membershipType: 'staff',
      isActive: true,
      isEmailVerified: true,
    });

    const librarian2 = await User.create({
      name: 'Marcus Brody',
      email: 'marcus.librarian@library.com',
      password: 'Librarian@123456',
      role: 'librarian',
      membershipType: 'staff',
      isActive: true,
      isEmailVerified: true,
    });

    const student = await User.create({
      name: 'Alex Johnson',
      email: 'student@library.com',
      password: 'Student@123456',
      role: 'student',
      membershipType: 'student',
      studentId: 'STD-2026-9901',
      department: 'Computer Science',
      isActive: true,
      isEmailVerified: true,
    });
    console.log(`Seeded 4 users (1 Admin, 2 Librarians, 1 Student).`);

    console.log('\n--- SEEDING 20 REAL BOOKS WITH 3 COPIES EACH ---');
    let totalCopiesCreated = 0;

    for (let i = 0; i < booksData.length; i++) {
      const bData = booksData[i];
      const shelfZone = String.fromCharCode(65 + (i % 6)); // A - F
      const shelfBay = Math.floor(i / 6) + 1;

      const createdBook = await Book.create({
        ...bData,
        totalCopies: 3,
        availableCopies: 3,
        addedBy: admin._id,
        isActive: true,
      });

      // Create 3 copies for this book
      const copiesToInsert = [];
      for (let c = 1; c <= 3; c++) {
        const copyNumStr = String(c).padStart(3, '0');
        copiesToInsert.push({
          book: createdBook._id,
          copyNumber: `${createdBook.isbn}-${copyNumStr}`,
          barcode: `BC-${createdBook.isbn}-${copyNumStr}`,
          condition: c === 3 ? 'good' : 'new',
          status: 'available',
          shelfLocation: `${shelfZone}-${shelfBay}-${c}`,
          purchasePrice: createdBook.price,
          addedBy: librarian1._id,
        });
      }

      await Copy.insertMany(copiesToInsert);
      totalCopiesCreated += copiesToInsert.length;
    }

    console.log(`Seeded ${booksData.length} books and ${totalCopiesCreated} physical copies.`);

    console.log('\n=========================================');
    console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY');
    console.log('=========================================');
    console.log('Credentials:');
    console.log('  Admin:      admin@library.com / Admin@123456');
    console.log('  Librarian1: sarah.librarian@library.com / Librarian@123456');
    console.log('  Librarian2: marcus.librarian@library.com / Librarian@123456');
    console.log('  Student:    student@library.com / Student@123456');
    console.log('=========================================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Data Import Failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await connectDB();

    console.log('--- PURGING ALL DATABASE COLLECTIONS ---');
    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      Copy.deleteMany({}),
      Transaction.deleteMany({}),
      Reservation.deleteMany({}),
      Fine.deleteMany({}),
      MembershipType.deleteMany({}),
      Notification.deleteMany({}),
      Review.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);

    console.log('✅ ALL DATABASE DATA DESTROYED SUCCESSFULLY');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Data Destruction Failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Handle CLI flags
if (process.argv[2] === '--destroy' || process.argv[2] === '-d') {
  destroyData();
} else if (process.argv[2] === '--import' || process.argv[2] === '-i' || !process.argv[2]) {
  importData();
} else {
  console.log('Usage: node seeder.js [--import | --destroy]');
  process.exit(0);
}
