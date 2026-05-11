import { createDefaultPreset } from 'ts-jest';

/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transform: {
    ...createDefaultPreset().transform,
  },
};
