#!/usr/bin/env node
'use strict';
import('../dist/index.mjs')
	.then((r) => r.main());
