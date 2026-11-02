'use strict';
// A downloaded game's app.asar is an opaque file, NOT a directory in OUR package.
// Never toggle process.noAsar globally: use raw OS filesystem APIs only in game I/O.
module.exports=process.versions.electron?require('original-fs'):require('node:fs');
