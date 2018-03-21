'use strict';

const probe = require('probe-image-size');

async function fitImage(url, maxHeight = 300, maxWidth = 400) {
	let {height, width} = await probe(url);

	let ratio = 1;

	if (width <= maxWidth && height <= maxHeight) return [width, height];

	if (height * (maxWidth/maxHeight) > width) {
		ratio = maxHeight / height;
	} else {
		ratio = maxWidth / width;
	}

	return [Math.round(width * ratio), Math.round(height * ratio)];
}

module.exports = {
    fit: fitImage,
};