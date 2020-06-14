/**
 * @author mrdoob / http://mrdoob.com/
 * @author Erik Sombroek / https://github.com/eriksom
 */

import {
	EventDispatcher, Raycaster, Vector3, Object3D, ArrowHelper, Math as ThreeMath, Matrix4
} from "three";

Vector3.zero = new Vector3();
Vector3.left = new Vector3(-1, 0, 0);
Vector3.right = new Vector3(1, 0, 0);
Vector3.up = new Vector3(0, -1, 0);
Vector3.down = new Vector3(0, 1, 0);
Vector3.forward = new Vector3(0, 0, -1);
Vector3.backward = new Vector3(0, 0, 1);


var CameraPhysics = function ( camera, target, gravity, playerMass, playerHeight ) {
	var scope = this;

	this.object = new Object3D();
	this.object.add(camera);
    target.add(scope.object);

    camera.lookAt(camera.position.x, camera.position.y, camera.position.z+1.0);
	this.gravity = gravity || 5.5;
	this.playerMass = playerMass || 80.0; // kilos
	this.playerHeight = playerHeight || 2.0; // meters
	this.jumpForce = 4000.0;
	this.movementSpeed = 250.0;
	this.groundFriction = 10.0;
	this.velocity = new Vector3();
	this.direction = new Vector3();
	this.canJump = false;

	this.panYDegree = 30;
	this.panYVelocity = 0;
	this.panYSmooth = 0.8;

	this.forwards = 0;
	this.strafe = 0;
	this.jump = false;

	this.raycaster = new Raycaster(new Vector3(), new Vector3(0, -1, 0), 0, this.playerHeight);

	this.collisions = {
		front:{collision:false, distance:Number.POSITIVE_INFINITY},
		back:{collision:false, distance:Number.POSITIVE_INFINITY},
		left:{collision:false, distance:Number.POSITIVE_INFINITY},
		right:{collision:false, distance:Number.POSITIVE_INFINITY},
		down:{collision:false, distance:Number.POSITIVE_INFINITY}
	}

	this.vec = new Vector3();
	this.mx = new Matrix4();

	this.moveForward = function ( distance ) {
		this.vec.setFromMatrixColumn( camera.matrixWorld, 0 );
		this.vec.crossVectors( camera.up, this.vec );
		this.object.position.addScaledVector( this.vec, distance );
	};

	this.moveRight = function ( distance ) {
		this.vec.setFromMatrixColumn( camera.matrixWorld, 0 );
		this.object.position.addScaledVector( this.vec, distance );
	};
	this.panRight = function(dir){
		scope.panYVelocity = ThreeMath.degToRad(scope.panYDegree*dir);
	}

	this.arrowHelpers = [];
	for(let i = 0; i<5; i++){
		scope.arrowHelpers.push(new ArrowHelper( new Vector3()));
		target.add( scope.arrowHelpers[i] );
		scope.arrowHelpers[i].setLength(0.3);
		scope.arrowHelpers[i].setColor('green');

	}

	this.checkCollisions = function(delta, objects){

		// proportions tall humanoid
		const width = 0.6;
		const length = 0.34
		const height = 2.0;

		// forward
		var headHeight = 0.3
		var origin = scope.object.position.clone().add(scope.vec.set(0, -height/2+headHeight, 0));

		// forward direction
		scope.vec.setFromMatrixColumn( camera.matrixWorld, 0 );
		scope.vec.crossVectors( camera.up, scope.vec );

		if (scope.velocity.z < 0) {
			scope.collisions.front = scope.planeCast(origin, scope.vec.clone(), width, height, (length/2)+Math.abs(scope.velocity.z * delta * 2), objects);
		}else{
			scope.collisions.back = scope.planeCast(origin, scope.vec.clone().negate(), width, height, (length/2)+Math.abs(scope.velocity.z * delta * 2), objects);
		}

		// sidewards
		if (scope.velocity.x < 0) {
			scope.vec.setFromMatrixColumn( camera.matrixWorld, 0 );
			scope.collisions.right = scope.planeCast(origin, scope.vec.clone(), length, height, (width/2)+Math.abs(scope.velocity.x * delta * 2), objects);
		}else{
			scope.vec.setFromMatrixColumn( camera.matrixWorld, 0 );
			scope.collisions.left = scope.planeCast(origin, scope.vec.clone().negate(), length, height, (width/2)+Math.abs(scope.velocity.x * delta * 2), objects);
		}

		// downwards
		origin = scope.object.position.clone();

		// downward direction
		scope.vec.setFromMatrixColumn( camera.matrixWorld, 0 );
		scope.mx.lookAt(Vector3.zero, scope.vec, Vector3.up);
		scope.vec.copy(Vector3.down).applyMatrix4(scope.mx);

		scope.collisions.down = scope.planeCast(origin, scope.vec.clone(), length, width, scope.playerHeight-scope.velocity.y*delta, objects);


	}
	this.planeCast = function(origin, direction, width, height, length, objects){

		const returnValue = {collision:false, distance:Number.POSITIVE_INFINITY};

		for(let i = 0; i<5; i++){
			const arrowHelper = scope.arrowHelpers[i];
			arrowHelper.position.copy(origin)
			arrowHelper.setLength(length/2);

			scope.raycaster.ray.origin.copy(origin);
			scope.raycaster.far = length;

			if(i<4){
				const offsetX = (width/2) * ( i < 2 ? 1 : -1)// ++--
				// x axis
				scope.mx.lookAt(Vector3.zero, direction, Vector3.up);
				this.vec.copy(Vector3.left).applyMatrix4(scope.mx);
				// apply x axis offset
				arrowHelper.position.addScaledVector(scope.vec, offsetX);
				scope.raycaster.ray.origin.addScaledVector(scope.vec, offsetX);

				const offsetY = (height/2) * ( i % 2 ? 1 : -1)// -+-+
				// y axis
				this.vec.copy(Vector3.up).applyMatrix4(scope.mx);
				// apply x axis offset
				arrowHelper.position.addScaledVector(scope.vec, offsetY)
				scope.raycaster.ray.origin.addScaledVector(scope.vec, offsetY);
			}

			arrowHelper.setDirection(direction);
			scope.raycaster.ray.direction.copy(direction);

			const intersections = scope.raycaster.intersectObjects(objects);
			const collide = intersections.length > 0;

			if(collide){
				returnValue.collision = true;
				if(intersections[0].distance < returnValue.distance) returnValue.distance = intersections[0].distance;
			}

		 }

		 return returnValue;
	}

	this.update = function(delta, objects){
		// apply gravity
		scope.velocity.y -=  scope.gravity * scope.playerMass * delta

		// apply ground friction
		scope.velocity.x -= scope.velocity.x * scope.groundFriction * delta;
		scope.velocity.z -= scope.velocity.z * scope.groundFriction * delta;

		scope.direction.z = Number(scope.forwards);
		scope.direction.x = Number(scope.strafe);


		let forwardsMovement = 0;
		let strafeMovement = 0;

		const moveSpeedDelta = scope.movementSpeed  * delta;

		if (scope.forwards) forwardsMovement = scope.direction.z * moveSpeedDelta;
		if (scope.strafe) strafeMovement = scope.direction.x * moveSpeedDelta;


		const forwardMovementPow2 = forwardsMovement*forwardsMovement;
		const strafeMovementPow2 = strafeMovement*strafeMovement;

		const totalMovementSpeed = Math.abs(forwardMovementPow2) + Math.abs(strafeMovementPow2);
		const allowedMovementSpeed = moveSpeedDelta * moveSpeedDelta;

		if(totalMovementSpeed > allowedMovementSpeed){
			const reducer = allowedMovementSpeed / totalMovementSpeed;

			forwardsMovement = (forwardsMovement < 0 ? -1 : 1) * Math.pow(Math.abs(forwardMovementPow2*reducer), 1/2)
			strafeMovement = (strafeMovement < 0 ? -1 : 1) * Math.pow(Math.abs(strafeMovementPow2*reducer), 1/2)
		}

		scope.velocity.z -= forwardsMovement;
		scope.velocity.x -= strafeMovement;

		scope.checkCollisions(delta, objects);

		// apply translations

		// jump
		if(scope.canJump && scope.jump){
			scope.velocity.y += scope.jumpForce * delta;
			scope.canJump = false;
		}

		// downwards
		if (scope.velocity.y <= 0 && scope.collisions.down.collision === true) {
			scope.object.position.y += -scope.collisions.down.distance+scope.playerHeight;
			scope.velocity.y = Math.max(0, scope.velocity.y);
			scope.canJump = true;
		}
		this.object.position.y += scope.velocity.y * delta;

		// sidewards
		if((scope.velocity.x < 0 && scope.collisions.right.collision) || (scope.velocity.x > 0 && scope.collisions.left.collision)){
			scope.velocity.x = 0
		}
		scope.moveRight(-scope.velocity.x * delta);

		// forwards
		if((scope.velocity.z < 0 && scope.collisions.front.collision) || (scope.velocity.z > 0 && scope.collisions.back.collision)){
			scope.velocity.z = 0;
		}
		scope.moveForward(-scope.velocity.z * delta);

		scope.panYVelocity = scope.panYVelocity*scope.panYSmooth
		scope.object.rotateY(scope.panYVelocity);

	}

};

CameraPhysics.prototype = Object.create( EventDispatcher.prototype );
CameraPhysics.prototype.constructor = CameraPhysics;

export { CameraPhysics };
