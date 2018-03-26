'use strict';

// @ts-ignore
const probe = require('probe-image-size');

/**
 * @param {string} url
 */
function fitImage(url, maxHeight = 300, maxWidth = 400) {
	return new Promise((resolve, reject) => {
		probe(url).then(/**@param {AnyObject} dimensions */ dimensions => {
			let {height, width} = dimensions;
			let ratio = 1;

			if (width <= maxWidth && height <= maxHeight) return resolve([width, height]);

			if (height * (maxWidth / maxHeight) > width) {
				ratio = maxHeight / height;
			} else {
				ratio = maxWidth / width;
			}

			return resolve([Math.round(width * ratio), Math.round(height * ratio)]);
		},
		() => resolve(false));
	});
}

module.exports = {
	fit: fitImage,
};