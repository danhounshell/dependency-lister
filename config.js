"use strict";

let config = require( "./configs/config.default.js" );

function mergeConfig( path ) {
	try {
		const otherConfig = require( path ); // eslint-disable-line global-require
		config = { ...config, ...otherConfig};
	} catch ( e ) {} // eslint-disable-line no-empty
}

mergeConfig( "./config.local" );

config.identity = [ require( "os" ).hostname(), config.name, process.pid ].join( "." ); // eslint-disable-line global-require
module.exports = Object.freeze( config );