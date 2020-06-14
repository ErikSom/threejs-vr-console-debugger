/* eslint-disable no-undef */
/**
 * @author mrdoob / http://mrdoob.com/
 * @author Erik Sombroek / https://github.com/eriksom
 */

import {
	EventDispatcher, Object3D, VertexColors, MeshBasicMaterial, Mesh, BoxGeometry, Vector3, Box3, CanvasTexture, LinearFilter
} from "three";

import CanvasInput from './CanvasInput';
import { gl } from "../components/threeManager";


var PropertyAnimator = function() {
	var scope = this;
	this.previousTime = Date.now();
	this.animations = [];

	this.addAnimation = function(target, propertyName, initialValue, targetValue, time, ease, complete){
		if(!ease) ease = 'linear';
		for(var i = 0; i<scope.animations.length; i++){
			var animation = scope.animations[i];
			if(animation.target === target && animation.propertyName === propertyName){
				this.animations.splice(i, 1);
				break;
			}
		}
		this.animations.push({target, propertyName, initialValue, targetValue, time, ease, complete, timeProgress:0});
	}
	this.progress = function(ct, nt, ease){
		let t = ct/nt;
		switch(ease){
			case 'linear': return t;
			case 'easeInQuad': return t*t;
			case 'easeOutQuad': return t*(2-t);
			case 'easeInOutQuad': return t<.5 ? 2*t*t : -1+(4-2*t)*t;
			case 'easeInCubic': return t*t*t;
			case 'easeOutCubic': return (--t)*t*t+1;
			case 'easeInOutCubic': return t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1;
			case 'easeInQuart': return t*t*t*t;
			case 'easeOutQuart': return 1-(--t)*t*t*t;
			case 'easeInOutQuart': return t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t;
			case 'easeInQuint': return t*t*t*t*t;
			case 'easeOutQuint': return 1+(--t)*t*t*t*t;
			case 'easeInOutQuint': return t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t;
		}
	}

	this.update = function(){
		var time = Date.now();
		var delta = time-scope.previousTime;
		scope.previousTime = time;
		for(var i = 0; i<scope.animations.length; i++){
			var animation = scope.animations[i];
			if(!animation.target || animation.timeProgress>= animation.time){
				if(typeof animation.complete === 'function') animation.complete();
				scope.animations.splice(i, 1);
				i--;
			}
			animation.timeProgress += delta;
			var valueDif = animation.targetValue-animation.initialValue;
			var progress = Math.min(1.0, scope.progress(animation.timeProgress, animation.time, animation.ease));
			var targetValue = animation.initialValue+valueDif*progress;
			if(typeof animation.target[animation.propertyName] === 'function') animation.target[animation.propertyName](targetValue);
			else animation.target[animation.propertyName] = targetValue;
		}
	}
	this.updateInterval = setInterval(scope.update, 1000/60); // 60hz
}
var propAnim = new PropertyAnimator();


var VRConsoleDebugger = function ( gl ) {
	var scope = this;

	this.object = new Object3D();
	this.defaultScale = 0.2;
	this.defaultPanelMaterial = new MeshBasicMaterial( { color: 0xffffff, vertexColors: VertexColors });
	this.interactiveObjects = [];
	this.textArea = null;
	this.show = false;

	this.vec = new Vector3();
	this.box3 = new Box3();
	this.nativeFunctions = {};
	this.consoleValue = '';
	this.maxHistoryCommandsBuffer = 50;
	this.historyCommands = JSON.parse(localStorage.getItem('__historyCommands') || '[]');
	this.historyCommandIndex = this.historyCommands.length-1;
	this.outputHistory = [];
	this.outputHistoryIndex = 0;
	this.maxOutputHistoryBuffer = 20;

	this.createPanel = function(width, height, depth){
		var material = this.defaultPanelMaterial;
		var panel = new Mesh( new BoxGeometry( width, height, depth ), material );
		// panel.geometry.translate( width * 0.5, 0, 0 );
		return panel;
	}
	this.colorizeGeometry = function( geometry, color ){
		geometry.faces.forEach( function(face){
		  face.color.setHex(color);
		});
		geometry.colorsNeedUpdate = true;
		return geometry;
	}
	this.addToObject = function(object){
		if(scope.object.parent === object){
			scope.show = !scope.show;
		}else{
			scope.show = true;
		}
		if(scope.show){
			scope.object.visible = true;
			propAnim.addAnimation(scope.object.scale, 'setScalar', scope.object.scale.x, scope.defaultScale, 150, 'easeInQuad');
		}else{
			propAnim.addAnimation(scope.object.scale, 'setScalar', scope.object.scale.x, 0, 150, 'easeOutQuad', ()=>{scope.object.visible=false});
		}
		object.add(scope.object);
		scope.object.rotation.set(0,0,0);
		scope.object.position.set(0,0.32,0);
	}
	this.setHooks = function(){
		var hooks = ['log', 'warn', 'error'/*, info*/];
		hooks.forEach(hook =>{
			if (window.console[hook]){
				scope.nativeFunctions[hook] = window.console[hook];
				window.console[hook] = function(){
					setTimeout(()=>{
						var args = [].slice.call(arguments);
						scope.nativeFunctions[hook].apply(window.console, args);

						let prefixText = '';
						if(args && (hook === 'log' || hook === 'info')){
						args.forEach(arg => {
							if(arg !== scope){
								const targetIndex = scope.outputHistoryIndex%scope.maxOutputHistoryBuffer;
								scope.outputHistory[targetIndex] = arg;
								prefixText = `§${targetIndex}: `;
								scope.outputHistoryIndex++;
							}
						});
						}

						var parsedText = prefixText + scope.stringifyArguments(args);
						scope.logValue(parsedText, hook);
					}, 0);
				};
			}
		});
		window.addEventListener('error',
		 function (err) {
			var message = [
			'Message: ' + err.message,
			'URL: ' + err.filename,
			'Line: ' + err.lineno,
			'Column: ' + err.colno,
			].join(' - ');
			scope.logValue(message, 'error');
			return false;
		  });

		  setTimeout(()=>{
			  console.warn("This is a warning");
			  console.error("This is an error");
		  }, 3000);
	}
	this.stringifyArguments = function(inputArgs){
		var args = [].slice.call(inputArgs);
		for (var i = 0; i < args.length; i++){
			try {
				if (typeof args[i] !== 'string'){
					args[i] = JSON.stringify(args[i], function(key, value) {
						return value === undefined ? 'undefined' : value;
					});
				}
			}
			catch(err){
				scope.logValue(err, 'errors');
			}
		}
		return args.join(' ');
	}
	this.logValue = function(text, type){
		if(type === 'error'){
			text = TextAreaMesh.styleText(text, 'red', 'bold');
		}else if(type === 'warn'){
			text = TextAreaMesh.styleText(text, '#c88d0d', 'oblique');
		}
		this.textArea.addMessage(text);
	}
	this.keyDown = function(e){
		if(e.keyChar === 'SHIFT') return;
		else if(e.keyChar === 'ARROW_UP' || e.keyChar === 'ARROW_DOWN'){
			const mutation = e.keyChar === 'ARROW_UP' ? 1 : -1;
			scope.historyCommandIndex = Math.min(scope.historyCommands.length-1, Math.max(0, scope.historyCommandIndex+mutation))
			scope.consoleValue = scope.historyCommands[scope.historyCommandIndex];
			scope.textInput.setCursorIndex(scope.consoleValue.length);
		} else if(e.keyChar === 'ARROW_LEFT'){
			scope.textInput.setCursorIndex(Math.max(0, scope.textInput.getCursorIndex()-1));
		}else if(e.keyChar === 'ARROW_RIGHT'){
			if(scope.textInput.getCursorIndex() === scope.consoleValue.length){
				var hint = scope.getCodeHints(scope.consoleValue);
				if(hint.length>scope.consoleValue.length){
					 scope.consoleValue = hint;
					 scope.textInput.setCursorIndex(scope.consoleValue.length);
				}
			}else{
				scope.textInput.setCursorIndex(Math.min(scope.consoleValue.length, scope.textInput.getCursorIndex()+1));
			}
		}else if(e.keyChar === 'BACKSPACE') {
			const firstPart = scope.consoleValue.substr(0, scope.textInput.getCursorIndex()-1);
			const secondPart = scope.consoleValue.substr(scope.textInput.getCursorIndex());
			scope.consoleValue = firstPart+secondPart;
			scope.textInput.setCursorIndex(Math.max(0, Math.min(scope.consoleValue.length, scope.textInput.getCursorIndex()-1)));
		} else if(e.keyChar === "ENTER") {
			if(scope.consoleValue === '') return;
			const answer = scope.runCode(scope.consoleValue);
			if(!answer.error){
				scope.logValue(answer.message, 'log');
			}else{
				scope.logValue(answer.message, 'error');
			}
			if(scope.historyCommands[scope.historyCommands.length-1] !== scope.consoleValue) scope.historyCommands.push(scope.consoleValue);
			if(scope.historyCommands.length>scope.maxHistoryCommandsBuffer) scope.historyCommands.shift();
			localStorage.setItem('__historyCommands', JSON.stringify(scope.historyCommands));
			scope.historyCommandIndex = scope.historyCommands.length-1;
			scope.consoleValue = '';
			scope.textInput.setCursorIndex(0);
		}
		else{
			var incomingChar = ''
			if(e.keyChar === 'SPACE'){
				incomingChar = ' ';
			}else{
				incomingChar = scope.keyboard.shiftDown ? e.keyChar.toUpperCase() : e.keyChar.toLowerCase();
			}
			if(incomingChar === '(') incomingChar+=')';
			if(incomingChar === '[') incomingChar+=']';
			if(incomingChar === '{') incomingChar+='}';
			if(incomingChar === '<') incomingChar+='>';
			if(incomingChar === "'") incomingChar+="'";
			if(incomingChar === '"') incomingChar+='"';

			const firstPart = scope.consoleValue.substr(0, scope.textInput.getCursorIndex());
			const secondPart = scope.consoleValue.substr(scope.textInput.getCursorIndex());
			scope.consoleValue = firstPart+incomingChar+secondPart;
			scope.textInput.cursorIndex = scope.textInput.getCursorIndex()+1;
		}
		var renderText = scope.getCodeHints(scope.consoleValue);
		scope.textInput.setValue(renderText);
		scope.textInput.setSelection(scope.consoleValue.length, renderText.length);
		scope.textInput.setCursorIndex(scope.textInput.getCursorIndex());
	}
	this.getCodeHints = function (string){
		if(string === '') return '';
		const lastDot = string.lastIndexOf('.');
		let possibleKeys = [];
		let hint = string;
		var path = string.substr(0, lastDot);
		let searchString = string;
		if(lastDot > 0){
			var answer = this.runCode(path)
			if(!answer.error){
				try{
					var obj = answer.obj;
					possibleKeys = Object.keys(obj).concat(Object.keys(Object.getPrototypeOf(obj)));
					searchString = string.substr(lastDot+1)
				}catch(err){
				};
			}
		}else{
			possibleKeys = Object.keys(window)
			possibleKeys.push('window');
			possibleKeys.push('console');
		}
		for(var i = 0; i<possibleKeys.length; i++){
			var key = possibleKeys[i];
			if(key.startsWith(searchString)){
				hint = `${path !== '' ? (path+'.') : ''}${key}`;
				break;
			}
		};
		return hint;
	}
	this.runCode = function(string){

		let hasRef = false;
		let obj = undefined
		if(string.startsWith('§')){
			let firstDot = string.indexOf('.');
			if(firstDot < 0) firstDot = string.length;
			let number = string.substr(0, firstDot);
			const textReplace = 'this.outputHistory[';
			number = number.replace('§', textReplace);
			if(number === textReplace) number += (scope.outputHistoryIndex-1)%scope.maxOutputHistoryBuffer;
			number += ']';
			string = number+string.substr(firstDot, string.length);
			hasRef = true;
		}

		var message;
		var error = false;
		try {
			// eslint-disable-next-line no-new-func
			if(!hasRef) message = Function('"use strict";return (' + string + ')')();
			else message = Function('"use strict";return (' + string + ')').bind(scope)();
			obj = message;
		} catch (e){
			message = e.message;
			error = true;
		}
		try{
			message = JSON.stringify(message);
		} catch(e){
			message = e.message;
			error = true;
		}
		message = ""+message;
		return {
			message,
			error,
			obj
		};
	}
	this.init = function(){

		var panel = scope.createPanel(VRConsoleDebugger.WINDOW_WIDTH, VRConsoleDebugger.WINDOW_HEIGHT, VRConsoleDebugger.PANEL_DEPTH);
		scope.object.add(panel);

		this.textArea = new TextAreaMesh(gl, VRConsoleDebugger.WINDOW_WIDTH, VRConsoleDebugger.WINDOW_HEIGHT);
		scope.interactiveObjects.push(this.textArea);
		scope.object.add(this.textArea);

		this.textInput = new TextInputMesh(gl, VRConsoleDebugger.WINDOW_WIDTH, 1/(512/32));
		this.textInput.position.y -= 0.53;
		this.textInput.position.z += 0.001;

		scope.object.add(this.textInput);

		this.keyboard = new KeyboardMesh(gl, VRConsoleDebugger.WINDOW_WIDTH*1.6, 1.0);
		scope.interactiveObjects.push(this.keyboard);
		scope.object.add(this.keyboard);
		this.keyboard.position.y -= 1.1;
		this.keyboard.position.z += 0.002;
		this.keyboard.addEventListener('keydown', scope.keyDown);

		scope.object.scale.setScalar(0);

		this.setHooks();
	}

	this.init();
};

VRConsoleDebugger.WINDOW_WIDTH = 1.0;
VRConsoleDebugger.WINDOW_HEIGHT = 1.0;
VRConsoleDebugger.CONSOLE_LOG_FONTSIZE = 0.05;
VRConsoleDebugger.PANEL_DEPTH = 0.001;


VRConsoleDebugger.prototype = Object.create( EventDispatcher.prototype );
VRConsoleDebugger.prototype.constructor = VRConsoleDebugger;

export { VRConsoleDebugger }


var TextAreaMesh = function(gl, width, height, parameters) {
    if (parameters === undefined) parameters = {};

	this.messages = [];
    this.fontface = parameters.hasOwnProperty("fontface") ? parameters["fontface"] : "Arial";
    this.fontsize = parameters.hasOwnProperty("fontsize") ? parameters["fontsize"] : 14;
	this.backgroundColor = parameters.hasOwnProperty("backgroundColor") ? parameters["backgroundColor"] : { r: 255, g: 255, b: 255, a: 1.0 };
	this.margin = parameters.hasOwnProperty("margin")  ? parameters.hasOwnProperty("margin") : 10;
	this.rowMargin = parameters.hasOwnProperty("margin")  ? parameters.hasOwnProperty("margin") : 16;
	this.scrollable = parameters.hasOwnProperty("scrollable") ? parameters.hasOwnProperty("scrollable") : false;
	this.align = parameters.hasOwnProperty("align") ? parameters.hasOwnProperty("align") : ["left", "top"];
	this.scrollable = true;
	this.unitToPixelRatio = 512; // 512px canvas per 1 size of mesh
	this.maxImageHeight = 8192;
	this.currentLines = 0;
	this.scrollY = 0.0;
	var scope = this;
	this.estimatedTextHeight = scope.fontsize + scope.margin;

	this.canvas = document.createElement('canvas');
	scope.canvas.width = width*scope.unitToPixelRatio;
	scope.canvas.height = height*scope.unitToPixelRatio;
	this.context = scope.canvas.getContext('2d');

	this.textCanvas = document.createElement('canvas');
	scope.textCanvas.width = scope.canvas.width;
	scope.textCanvas.height = scope.maxImageHeight;
	this.textContext = scope.textCanvas.getContext('2d', {alpha:false});
	scope.textContext.fillStyle = 'white';
	scope.textContext.rect(0, 0, scope.textCanvas.width, scope.textCanvas.height);
	scope.textContext.fill();

	this.texture = new CanvasTexture(scope.canvas);
	scope.texture.anisotropy = gl.getMaxAnisotropy();
	this.materials = [
		new MeshBasicMaterial({ map: scope.texture, transparent:true}),
		new MeshBasicMaterial( { transparent: true, opacity: 0 }),
	];
	this.materials[0].map.minFilter = LinearFilter;
	this.geometry = new BoxGeometry(width, height, 0.01);

	for( var i = 0; i < scope.geometry.faces.length; i++ ) {
		scope.geometry.faces[ i ].materialIndex = 1;
	}
	scope.geometry.faces[ 8 ].materialIndex = 0;
	scope.geometry.faces[ 9 ].materialIndex = 0;
	scope.geometry.sortFacesByMaterialIndex();

	Mesh.call( this,  scope.geometry, scope.materials);

	this.addMessage = function(message){
		var maxCharsPerMessage = 250;
		message = message.substr(0, maxCharsPerMessage);
		scope.messages.push(message);
		this.updateText();
	}

	this.updateText = function(){
		const scrollBuffer = scope.scrollable ? scope.fontsize*4 : 0;
		const autoScroll = Math.abs(scope.scrollY-(scope.canvas.height-scope.estimatedTextHeight)) <= scrollBuffer;


		scope.currentLines = 0;

		scope.textContext.strokeStyle = 'rgba(0, 0, 0, 0.2)';

		for(var i = 0; i<scope.messages.length; i++){
			let message = scope.messages[i];
			scope.textContext.fillStyle = "black";
			scope.textContext.font = "normal normal normal " + scope.fontsize + "px " + scope.fontface;
			if(message.charAt(0) === TextAreaMesh.STRING_PROPS_DELIMITTER){
				var parsedMessage = message.split(TextAreaMesh.STRING_PROPS_DELIMITTER);
				scope.textContext.fillStyle = parsedMessage[1];
				scope.textContext.font = "normal normal "+parsedMessage[2]+" " + scope.fontsize + "px " + scope.fontface;
				message = parsedMessage[3];
			}

			const printAt = function(text, x, y, lineHeight, fitWidth, wordWrap)
			{
				scope.currentLines++;
				for (var idx = 1; idx <= text.length; idx++)
				{
					var str = text.substr(0, idx);
					if (scope.textContext.measureText(str).width > fitWidth)
					{
						scope.textContext.fillText( text.substr(0, idx-1), x, y );
						printAt(text.substr(idx-1), x, y + lineHeight, lineHeight,  fitWidth, wordWrap);
						return;
					}
				}
				scope.textContext.fillText( text, x, y );
			}
			printAt(message, scope.margin, scope.estimatedTextHeight, scope.fontsize, scope.textCanvas.width-scope.margin*2);
			scope.textContext.beginPath();
			var lineY = scope.estimatedTextHeight+ (scope.currentLines-1)*scope.fontsize+scope.rowMargin/2;
			scope.textContext.moveTo(0, lineY);
			scope.textContext.lineTo(scope.textCanvas.width, lineY);
			scope.textContext.stroke();

		};
		scope.estimatedTextHeight += scope.currentLines*scope.fontsize+scope.rowMargin;

		if(scope.estimatedTextHeight > scope.maxImageHeight){
			const dropPercentage = 0.1;
			const dropHeight = scope.canvas.height*dropPercentage;

			var imageData = scope.textContext.getImageData(0, dropHeight, scope.textCanvas.width, scope.textCanvas.height-dropHeight);

			scope.textContext.fillStyle = 'white';
			scope.textContext.rect(0, 0, scope.textCanvas.width, scope.textCanvas.height);
			scope.textContext.fill();

			scope.textContext.putImageData(imageData, 0, 0);

			scope.estimatedTextHeight -= dropHeight;

		}
		if(autoScroll && !scope.isSelected){
			scope.scrollY = scope.canvas.height-scope.estimatedTextHeight;
			scope.updateScroll(true);
		}else{
			scope.drawText();
		}
		scope.messages = [];
	}

	this.drawText = function(){
		scope.context.clearRect(0, 0, scope.canvas.width, scope.canvas.height);

		scope.texture.needsUpdate = true;

		let xOffset = 0;
		let yOffset = 0;

		if(scope.align[0] === "middle"){
			xOffset = (scope.canvas.width-scope.textCanvas.width)/2;
		}  else if(scope.align[0] === "right"){
			xOffset = scope.canvas.width-scope.textCanvas.width;
		}

		if(scope.align[1] === "center"){
			yOffset = scope.canvas.height/2-(scope.estimatedTextHeight)/2;
		}  else if(scope.align[1] === "bottom"){
			yOffset = scope.canvas.height/2-(scope.estimatedTextHeight);
		}
		yOffset += scope.scrollY;

		scope.context.drawImage(scope.textCanvas, 0, 0, scope.textCanvas.width, scope.estimatedTextHeight, xOffset, yOffset, scope.textCanvas.width, scope.estimatedTextHeight);
	}

	this.scrollVelocity = 0;
	this.scrollDrag = 0.9;
	this.scrollBounce = 0.1;
	this.updateScroll = function(_forceDirty){
		if(scope.estimatedTextHeight< scope.canvas.height){
			scope.scrollY = 0;
		}else{
			scope.scrollY -= scope.scrollVelocity;

			if(scope.scrollY <= scope.canvas.height-scope.estimatedTextHeight){
				scope.scrollVelocity *= - scope.scrollBounce;
			}
			if(scope.scrollY >= 0){
				scope.scrollVelocity *= - scope.scrollBounce;
			}
			scope.scrollY = Math.max(scope.canvas.height-scope.estimatedTextHeight, Math.min(0, scope.scrollY));
		}
		scope.scrollVelocity *= scope.scrollDrag;

		var dirty = scope._oldScrollY !== scope.scrollY;

		if(_forceDirty || dirty){
			scope.drawText();
		}
		scope._oldScrollY = scope.scrollY;

	}

	this.scroll = function(delta){
		this.scrollVelocity += delta*50;
	}

	if(scope.scrollable){
		setInterval(scope.updateScroll, 1000/60)
	}

    return this;
}
TextAreaMesh.STRING_PROPS_DELIMITTER = '•';
TextAreaMesh.DEFAULT_TEXT_COLOR = 'black';
TextAreaMesh.styleText = function(text, color, weigth){
	var d = TextAreaMesh.STRING_PROPS_DELIMITTER;
	return String(d+color+d+(weigth ? weigth : 'normal')+d+text)
}
TextAreaMesh.prototype = Object.create( Mesh.prototype );
TextAreaMesh.prototype.constructor = TextAreaMesh;


var TextInputMesh = function(gl, width, height, parameter){

	this.unitToPixelRatio = 512;
	this.canvasInput = null;
	this.cursorIndex = 0;
	this.updateInterval = null;

	var scope = this;

	this.canvas = document.createElement('canvas');
	scope.canvas.width = width*scope.unitToPixelRatio;
	scope.canvas.height = height*scope.unitToPixelRatio;
	this.context = scope.canvas.getContext('2d');

	this.texture = new CanvasTexture(scope.canvas);
	scope.texture.anisotropy = gl.getMaxAnisotropy();

	this.materials = [
		new MeshBasicMaterial({ map: scope.texture, transparent: true}),
		new MeshBasicMaterial( { transparent: true, opacity: 0 }),
	];
	this.materials[0].map.minFilter = LinearFilter;
	this.geometry = new BoxGeometry(width, height, 0.01);

	for( var i = 0; i < scope.geometry.faces.length; i++ ) {
		scope.geometry.faces[ i ].materialIndex = 1;
	}
	scope.geometry.faces[ 8 ].materialIndex = 0;
	scope.geometry.faces[ 9 ].materialIndex = 0;
	scope.geometry.sortFacesByMaterialIndex();

	Mesh.call( this,  scope.geometry, scope.materials);

	this.setValue = function(str){
		this.canvasInput.value(str);
		this.canvasInput.focus();
	}
	this.setSelection = function(start, end){
		this.canvasInput.selectText([start, end]);
	}
	this.render = function(){
		scope.texture.needsUpdate = true;
	}
	this.getCursorIndex = function(){
		return scope.cursorIndex;
	}
	this.setCursorIndex = function(index){
		scope.cursorIndex = scope.canvasInput._cursorPos = index;
	}
	this.init = function(){
		this.canvasInput = new CanvasInput({canvas:scope.canvas, width:scope.canvas.width-14, placeHolder: 'Enter console message here...'});
		this.updateInterval = setInterval(function(){
			scope.render();
		}, 1000/60);
	}
	this.init();

}
TextInputMesh.prototype = Object.create( Mesh.prototype );
TextInputMesh.prototype.constructor = TextInputMesh;

var KeyboardMesh = function(gl, width, height, parameter){

	this.unitToPixelRatio = 512;
	this.fontsize = 18;
	this.fontface = 'Arial';
	this.canvasInput = null;

	this.keysPerRow = 15;
	this.rows = 6;
	this.keyMargin = 10;
	this.keySize = undefined;
	this.shiftDown = false;
	this.permaShift = false;

	this.functionScripts = [];
	this.keys = [
		[{w:2}, {c:['F1']}, {c:['F2']}, {c:['F3']}, {c:['F4']}, {c:['F5']}, {c:['F6']}, {c:['F7']}, {c:['F8']}, {c:['F9']}, {c:['F10']}, {c:['F11']}],
		[{c:['§', '±']}, {c:['1', '!']}, {c:['2', '@']}, {c:['3', '#']}, {c:['4', '$']}, {c:['5', '%']}, {c:['6', '^']}, {c:['7', '&']}, {c:['8', '*']}, {c:['9', '(']}, {c:['0', ')']}, {c:['-', '_']}, {c:['=', '+']}, {c:['ⓧ'], w:2}],
		[{}, {c:['Q']}, {c:['W']}, {c:['E']}, {c:['R']}, {c:['T']}, {c:['Y']}, {c:['U']}, {c:['I']}, {c:['O']}, {c:['P']}, {c:['[', '{']}, {c:[']', '}']}, {c:['ENTER'], w:2, h:2}],
		[{c:['⇪']}, {c:['A']}, {c:['S']}, {c:['D']}, {c:['F']}, {c:['G']}, {c:['H']}, {c:['J']}, {c:['K']}, {c:['L']}, {c:[';', ':']}, {c:["'", '"']}, {c:['\\', '|']}],
		[{c:['SHIFT'], w:2}, {c:['`', '~']}, {c:['Z']}, {c:['X']}, {c:['C']}, {c:['V']}, {c:['B']}, {c:['N']}, {c:['M']}, {c:[',', '<']}, {c:['.', '>']}, {c:['/', '?']}, {c:['SHIFT'], w:2}],
		[{w:4}, {c:['SPACE'], w:7}, {c:['◀']}, {c:['▶']}, {c:['▲']}, {c:['▼']}],
	]
	var scope = this;

	this.canvas = document.createElement('canvas');
	scope.canvas.width = width*scope.unitToPixelRatio;
	scope.canvas.height = height*scope.unitToPixelRatio;
	this.context = scope.canvas.getContext('2d');

	scope.context.font = "normal normal normal " + scope.fontsize + "px " + scope.fontface;

	this.texture = new CanvasTexture(scope.canvas);
	scope.texture.anisotropy = gl.getMaxAnisotropy();

	this.materials = [
		new MeshBasicMaterial({ map: scope.texture, transparent: true}),
		new MeshBasicMaterial( { transparent: true, opacity: 0 }),
	];
	this.materials[0].map.minFilter = LinearFilter;
	this.geometry = new BoxGeometry(width, height, 0.01);

	for( var i = 0; i < scope.geometry.faces.length; i++ ) {
		scope.geometry.faces[ i ].materialIndex = 1;
	}
	scope.geometry.faces[ 8 ].materialIndex = 0;
	scope.geometry.faces[ 9 ].materialIndex = 0;
	scope.geometry.sortFacesByMaterialIndex();

	Mesh.call( this,  scope.geometry, scope.materials);

	this.drawRoundedRectangle = function(x, y, w, h, r, text) {
		if (w < 2 * r) r = w / 2;
		if (h < 2 * r) r = h / 2;

		scope.context.beginPath();
		scope.context.moveTo(x+r, y);
		scope.context.arcTo(x+w, y,   x+w, y+h, r);
		scope.context.arcTo(x+w, y+h, x,   y+h, r);
		scope.context.arcTo(x,   y+h, x,   y,   r);
		scope.context.arcTo(x,   y,   x+w, y,   r);
		scope.context.closePath();
		scope.context.fill();

		if(text){
			for(var i = 0; i<text.length; i++){
				var txt = text[text.length-i-1];
				var textSize = scope.context.measureText(txt);
				var textX = (w-textSize.width)/2;
				var doubleKeyMargin = 5;
				var textY = h/2 + scope.fontsize/2 - ((text.length-1)*(scope.fontsize/2+doubleKeyMargin)) + ((scope.fontsize+doubleKeyMargin)*i);
				scope.oldFill = scope.context.fillStyle;
				scope.context.fillStyle = "black";
				scope.context.fillText( txt, x+textX, y+textY );
				scope.context.fillStyle = scope.oldFill;
			};
		}

		return scope.context;
	}

	this.drawKeyboard = function(){
		scope.context.strokeStyle = "#FF0000";

		scope.keySize = scope.canvas.width / scope.keysPerRow - scope.keyMargin;

		var x, y;
		for(var i = 0; i<scope.rows; i++){
			y = i*(scope.keySize+scope.keyMargin);
			var xp = 0;
			var row = scope.keys[i];
			for(var j = 0; j<row.length; j++){
				x = xp*(scope.keySize+scope.keyMargin);
				var key = scope.keys[i][j];
				if(key.rowIdentity && key.rowIdentity !== row){
				 	continue;
				}
				if(key.c){
					var keyText = scope.keys[i][j].c;
					if(keyText && keyText[0] === '⇪'){
						key.highlightColor =  scope.permaShift ? '#f6c36a' : '';
					}
					if(keyText && keyText[0] === 'SHIFT'){
						key.highlightColor = scope.shiftDown ? '#6af66a' : '';
					}
					scope.context.fillStyle = key.highlightColor || 'white';
					var keyWidth = scope.keySize * (key.w || 1);
					var keyHeight = scope.keySize * (key.h || 1);
					key.x = x+scope.keyMargin/2;
					key.y = y+scope.keyMargin/2;
					key.pixelSize = {w:keyWidth, h:keyHeight};
					scope.drawRoundedRectangle(key.x, key.y, keyWidth, keyHeight, 10, scope.keys[i][j].c);
					if(key.h){
						key.rowIdentity = row;
						scope.keys[i+1].push(key);
					}
				}
				xp += key.w ? key.w : 1;
			}
		}
		scope.texture.needsUpdate = true;
	}
	this.hover = function(intersection){
		//console.info(scope.getCollidingKey(intersection));
	}
	this.getCollidingKey = function(intersection){
		var textureCoord = scope.getTextureCoordinate(intersection);
		var row = Math.floor(textureCoord.y/(scope.keySize+scope.keyMargin));
		if(!scope.keys[row]) return null;

		for(var i = 0; i<scope.keys[row].length; i++){
			var key = scope.keys[row][i];
			if(!key.c) continue;
			if(textureCoord.x > key.x && textureCoord.x < key.x+key.pixelSize.w){
				if(textureCoord.y > key.y && textureCoord.y < key.y+key.pixelSize.h){
					return key;
				}
			}
		}
		return null;
	}
	this.getTextureCoordinate = function(intersection){
		var material = intersection.object.material[0];
		var uvPos = material.map.transformUv(intersection.uv);
		return {x:uvPos.x*scope.canvas.width, y:uvPos.y*scope.canvas.height};
	}
	this.select = function(intersection){
		var keyObject = scope.getCollidingKey(intersection);
		if(!keyObject) return;
		var shiftKey = scope.shiftDown ? 1 : 0;
		var keyChars = keyObject.c;
		var keyChar = keyChars.length > 1 ? keyChars[shiftKey] : keyChars[0];

		if(keyChar === '◀') keyChar = 'ARROW_LEFT';
		if(keyChar === '▶') keyChar = 'ARROW_RIGHT';
		if(keyChar === '▲') keyChar = 'ARROW_UP';
		if(keyChar === '▼') keyChar = 'ARROW_DOWN';
		if(keyChar === 'ⓧ') keyChar = 'BACKSPACE';
		if(keyChar.charAt(0) === 'F' && keyChar.length > 1){
			var targetScriptIndex = parseInt(keyChar.substr(1), 10)-1
			var script = this.functionScripts[targetScriptIndex];
			if(script) script();
			return;
		}

		if(keyChar === 'SHIFT'){
			scope.shiftDown = !scope.shiftDown;
			if(!scope.shiftDown) scope.permaShift = scope.shiftDown;
			scope.drawKeyboard();
		}
		if(keyChar === '⇪'){
			scope.permaShift = !scope.permaShift;
			scope.shiftDown = scope.permaShift;
			keyChar = 'SHIFT';
			scope.drawKeyboard();
		}

		scope.dispatchEvent({type:'keydown', keyChar});
		if((keyChar !== 'SHIFT' && keyChar !== '⇪') && !scope.permaShift && scope.shiftDown){
			scope.shiftDown = false;
			scope.drawKeyboard();
		}
	}
	this.assignScriptToFunctionKey = function(index, script){
		if(index<1 || index>11) console.error('[VRConsoleDebugger] F keys start at 1 and end at 11');
		this.functionScripts[index-1] = script
	}

	this.init = function(){
		scope.drawKeyboard();
	}
	scope.init();
}
KeyboardMesh.prototype = Object.create( Mesh.prototype );
KeyboardMesh.prototype.constructor = KeyboardMesh;
