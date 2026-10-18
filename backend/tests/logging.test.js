jest.mock('../src/routes', () => require('express').Router());
jest.mock('morgan', () => jest.fn(() => (req, res, next) => next()));

const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const originalNodeEnv = process.env.NODE_ENV;
const format = ':method :url :status :res[content-length] - :response-time ms :remote-addr';

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test('production creates the log directory and appends access logs with the required format', () => {
  process.env.NODE_ENV = 'production';
  const stream = { on: jest.fn() };
  const mkdir = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
  const open = jest.spyOn(fs, 'createWriteStream').mockReturnValue(stream);
  jest.isolateModules(() => require('../src/app'));
  const directory = path.resolve(__dirname, '../logs');
  expect(mkdir).toHaveBeenCalledWith(directory, { recursive: true });
  expect(open).toHaveBeenCalledWith(path.join(directory, 'access.log'), { flags: 'a' });
  expect(morgan).toHaveBeenCalledWith(format, { stream });
});

test('non-production uses the same format without opening a log file', () => {
  process.env.NODE_ENV = 'test';
  const open = jest.spyOn(fs, 'createWriteStream');
  jest.isolateModules(() => require('../src/app'));
  expect(morgan).toHaveBeenCalledWith(format);
  expect(open).not.toHaveBeenCalled();
});
