import babel from 'rollup-plugin-babel';
import { terser } from 'rollup-plugin-terser';
import copy from 'rollup-plugin-copy';
import json from 'rollup-plugin-json';
import commonjs from 'rollup-plugin-commonjs';
import stripCode from "rollup-plugin-strip-code"
import strip from '@rollup/plugin-strip';
import resolve from 'rollup-plugin-node-resolve';
import conditional from 'rollup-plugin-conditional';


const isProduction = process.env.NODE_ENV === 'production';
export default [
	{
		input: 'src/index.js',
		output: {
			file: 'build/scripts/vr-console-debugger.js',
			format: 'iife',
			strict: false,
		},
		plugins: [
			babel({
				exclude: 'node_modules/**'
			}),
			resolve(),
			commonjs(),

			json(),

			conditional(isProduction, [
				stripCode({
					start_comment: 'DEV',
					end_comment: 'DEV-END'
				}),
				strip({
					debugger: true,
				  }),
				terser(),
				]
			),
			copy({
				targets: [
					{ src: 'static/*', dest: 'build/' },
				],
				verbose:true,
			}),
		],
	},
];
