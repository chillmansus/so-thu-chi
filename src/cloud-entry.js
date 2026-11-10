// Bundled by build.mjs into dist/cloud.js. Gives the app one object, window.Cloud.
import { makeCloud } from './cloud.js';
import { firebaseBackend } from './cloud-firebase.js';

window.Cloud = makeCloud(firebaseBackend(window.FIREBASE_CONFIG));
