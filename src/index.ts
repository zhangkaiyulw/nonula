#!/usr/bin/env node
import findDominantFile from 'find-dominant-file';
import loadFile from 'load-any-file';
import * as path from 'path';
import collectionsFromArgs from './collectionsFromArgs';
import displayHelp from './displayHelp';
import displayVersion from './displayVersion';
import getModelFiles from './getModelFiles';
import { idMapSetMappingTable, idMapSetMongoose } from './idMap';
import loadConfig from './loadConfig';
import * as reporters from './reporters';
import reseed from './reseed';
import seed from './seed';
import unseed from './unseed';

async function startup(cwd: string = process.cwd(), argv: string[] = process.argv): Promise<void> {

  // Find project root directory
  const projRoot = findDominantFile(cwd, 'package.json', true);
  if (!projRoot) {
    throw new Error("Please run `seedgoose' inside your project directory.");
  }

  const [command, args, options] = loadConfig(projRoot, argv);

  // Show help and exit
  if (options.help) {
    displayHelp(process.stdout);
    return;
  }

  // Show version and exit
  if (options.version) {
    displayVersion(process.stdout);
    return;
  }

  // Check command availability
  if (!['seed', 'reseed', 'unseed'].includes(command)) {
    throw new Error(`Unknown seedgoose command \`${command}'.`);
  }

  // Requires data directory
  if (!options.data) {
    throw new Error('Please provide data directory.');
  }
  options.data = path.resolve(projRoot, options.data);

  // Load model files
  const modelFileList = getModelFiles(projRoot, options.models, options.modelBaseDirectory);
  modelFileList.forEach(require);

  // Connect mongoose
  const nodeModules = findDominantFile(cwd, 'node_modules', false);
  if (nodeModules) {
    module.paths.push(nodeModules);
  }
  const mongoose = require('mongoose');
  const connection = await mongoose.connect(options.db, {
    useNewUrlParser: true
  });

  idMapSetMongoose(mongoose);
  idMapSetMappingTable(options.mappingTable);
  const dataDir = path.join(projRoot, options.data);
  const reporter = reporters.default;
  const collections = collectionsFromArgs(dataDir, args, mongoose);
  try {
    // Execute command
    for (const collection of collections) {
      const records = loadFile(path.join(dataDir, collection));
      switch (command) {
        case 'seed':
        await seed(collection, records, mongoose, reporter);
        break;
        case 'reseed':
        await reseed(collection, records, mongoose, reporter);
        break;
        case 'unseed':
        await unseed(collection, records, mongoose, reporter);
        break;
      }
    }
  } catch(e) {
    throw e;
  } finally {
    // Close connection and exit
    await connection.disconnect();
  }
};

if (require.main === module) {
  startup(process.cwd(), process.argv);
}

module.exports = startup;