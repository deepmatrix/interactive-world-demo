/**
 * GenericTerrainMaterial.js
 * Useful for testing mostly.
 */

THREE.GenericTerrainMaterial = function (parameters) {
	if( typeof parameters == "undefined" ) {
		parameters = {};
	}

	this._textures = parameters.textures ? parameters.textures : false;

	if( this._textures == false ) {
		this._textures = [];
		this._textures.push({
			label: 'dirt',
			url: 'resources/world/terrain/textures/basic/grass-and-rock.png',
			start: 0 // Flag
		});

		this._textures.push({
			label: 'grass',
			url: 'resources/world/terrain/textures/basic/grass.png',
			start: 20,
			delta: 180
		});

		this._textures.push({
			label: 'rock',
			url: 'resources/world/terrain/textures/basic/rock.png',
			start: 150,
			delta: 60
		});

		this._textures.push({
			label: 'snow',
			url: 'resources/world/terrain/textures/basic/snow.png',
			start: 210,
			delta: 45
		});
	}

	this._textureRepeat = parameters.textureRepeat ? parameters.textureRepeat : 1;

	this._mixHeight = 10;
}

THREE.GenericTerrainMaterial.prototype._fragmentShader = function () {
	var shader = [];
	shader.push('varying vec2 vUv;');
	shader.push('varying vec3 vPosition;');
	shader.push("varying vec4 wPosition;");
	for( var i = 0; i < this._textures.length; i++ ) {
		shader.push('uniform sampler2D texture_'+this._textures[i].label+';');
	}

	shader.push('void main() {');

	for( var i = 0; i < this._textures.length; i++ ) {
		shader.push('vec4 color_'+this._textures[i].label+' = texture2D( texture_'+this._textures[i].label+', vUv );');
	}

	// Start with 0
	shader.push('vec4 color = color_'+this._textures[0].label+';');

	for( var i = 1; i < this._textures.length; i++ ) {
		shader.push('color = mix(color_'+this._textures[i].label+', color, min(abs('+parseFloat(this._textures[i].start).toFixed(2)+' - vPosition.y ) / '+parseFloat(this._textures[i].delta).toFixed(2)+', 1.0));');
	}

	shader.push('if( vPosition.y > '+parseFloat(this._textures[this._textures.length - 1].start+this._textures[this._textures.length - 2].delta).toFixed(2)+' ) { color = color_'+this._textures[this._textures.length - 1].label+'; }');
	
	shader.push('gl_FragColor = color;');

	shader.push('}');

	return shader.join("\n");
}

THREE.GenericTerrainMaterial.prototype._vertexShader = function () {
	var shader = [];

	shader.push("varying vec2 vUv;");
	shader.push("varying vec3 vPosition;");
	shader.push("varying vec4 wPosition;");
	shader.push("uniform float textureRepeat;");
	shader.push("void main( void ) {");
	shader.push("vUv = uv * textureRepeat;");
	shader.push("vPosition = position;");
	shader.push("wPosition = modelMatrix * vec4(vPosition,1);");
	shader.push("gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1);");
	shader.push("}");

	return shader.join("\n");
}

THREE.GenericTerrainMaterial.prototype.generateMaterial = function () {
	var uniforms = {};
	for( var i = 0; i < this._textures.length; i++ ) {
		uniforms['texture_'+this._textures[i].label] = {
			type: "t",
			value: THREE.ImageUtils.loadTexture(this._textures[i].url)
		};
// INTERESTING RESULT
//		uniforms['texture_'+this._textures[i].label].value.minFilter = THREE.NearestFilter;
//		uniforms['texture_'+this._textures[i].label].value.magFilter = THREE.NearestFilter;
	}
	uniforms.textureRepeat = {
		type: 'f',
		value: this._textureRepeat	// PASS THIS AS A PARAM
	};
	for( i in uniforms ) {
		if( uniforms[i].type == "t" ) {
			uniforms[i].value.wrapS = uniforms[i].value.wrapT = THREE.RepeatWrapping;
		}
	}

	return new THREE.ShaderMaterial({
		uniforms: uniforms,
		vertexShader: this._vertexShader(),
		fragmentShader: this._fragmentShader(),
		shading: THREE.SmoothShading
	});
}