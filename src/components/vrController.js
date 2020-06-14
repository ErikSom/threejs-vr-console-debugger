import {
	LineBasicMaterial, Geometry, Vector3, Line, Mesh, CircleGeometry, MeshBasicMaterial, Raycaster, TextureLoader, Quaternion
} from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import cameraPhysics from './cameraPhysics'
import { gl } from './threeManager'

const quat = new Quaternion();
const raycaster = new Raycaster();
raycaster.far = 10.0;

let controllers = null;
let xrSession = false;
let forwards = 0;
let strafe = 0;
let jump = false;

export const init = () => {
    const controller1 = gl.xr.getController( 0 );
    cameraPhysics.object.add( controller1 );

    const controller2 = gl.xr.getController( 1 );
    cameraPhysics.object.add( controller2 );

    intializePointer(controller1);
    intializePointer(controller2);

    const startXRSession = ()=>{
        xrSession = gl.xr.getSession();
        xrSession.addEventListener('inputsourceschange', ()=>{
            const xrInput = xrSession.inputSources;
            console.info(gl);
            if(!xrInput || !xrInput[0].profiles) return;
            const isQuest = xrInput[0].profiles.includes("oculus-touch");
            const isGenericDevice = xrInput[0].profiles.includes("generic-trigger-squeeze-thumbstick");

            if(isQuest || isGenericDevice){
                const leftIndexZero = xrInput[0].handedness === "left";
                let leftController = xrInput[(leftIndexZero ? 0 : 1)];
                leftController.gameObject = leftIndexZero ? controller1 : controller2;
                let rightController = xrInput[(leftIndexZero ? 1 : 0)];
                rightController.gameObject = leftIndexZero ? controller2 : controller1;
                controllers = [leftController, rightController];

                addTouchControllerModel(leftController.gameObject, 'left');
                addTouchControllerModel(rightController.gameObject, 'right');

            }
        });
    }
    gl.xr.addEventListener('sessionstart', startXRSession);
}
const raycastDestination = new Vector3();
const localZero = new Vector3();

export const update = ()=>{
    if(xrSession){
        readInput();
        doCursors();
	    Object.assign(cameraPhysics, {forwards, strafe, jump});
    }
}
const axesMoved = [];
const buttonsDown = [];
const readInput = ()=>{
    const [leftController, rightController] = controllers;

    forwards = -leftController.gamepad.axes[3];
    strafe =  leftController.gamepad.axes[2];


    const panIndex = 0;
    if(!axesMoved[panIndex]){
        let dir = 0;
        if(rightController.gamepad.axes[2] < 0){
            dir = 1;
        }else if(rightController.gamepad.axes[2] > 0){
            dir = -1;
        }
        if(dir){
            cameraPhysics.panRight(dir);
            axesMoved[panIndex] = true;
        }
    }else if(Math.abs(rightController.gamepad.axes[2]) <.1){
        axesMoved[panIndex] = false;
    }
    forwards = -leftController.gamepad.axes[3];
    strafe =  leftController.gamepad.axes[2];

    jump = (!buttonsDown[4] && rightController.gamepad.buttons[4].pressed); // pressed

    for(let i = 0; i<buttonsDown.length; i++){
        // reset button states
        buttonsDown[i] = rightController.gamepad.buttons[i].pressed;
    }

    /*

    Controller mapping Quest:

    Left controller:

    0: Trigger
    1: Middle finger trigger
    2: -
    3: Joystick Click
    4: X
    5: Y
    6: -

    Right controller:

    0: Trigger
    1: Middle finger trigger
    2: -
    3: Joystick Click
    4: A
    5: B
    6: -

    */
}


const doCursors = ()=>{
    controllers.forEach(controller =>{
        const other = controller === controllers[0] ? controllers[1] : controllers[0];

        raycastDestination.set(0, 0, -1);
        controller.gameObject.getWorldQuaternion(quat);
        raycastDestination.applyQuaternion(quat);

        localZero.set(0,0,0);
        controller.gameObject.localToWorld(localZero);

        raycaster.set(localZero, raycastDestination);
        let intersects = raycaster.intersectObjects([other.gameObject], true);

        controller.gameObject.cursor.visible = false;

        for(let intersect of intersects){

            if(intersect.object.type !== 'Line'){

            raycastDestination.set(0, 0, -1);

            raycastDestination.applyQuaternion(quat);
            raycastDestination.multiplyScalar(intersect.distance-0.001);
            raycastDestination.add(localZero);

            if(intersect.face){
                const n = intersect.face.normal.clone();
                n.transformDirection( intersect.object.matrixWorld );
                n.multiplyScalar( 10 );
                n.add( intersect.point );

                controller.gameObject.cursor.visible = true;

                controller.gameObject.worldToLocal(raycastDestination)
                controller.gameObject.cursor.position.copy(raycastDestination);

                controller.gameObject.cursor.lookAt(n);
            }

            break;
            }
        }
    });
}


const laserMaterial = new LineBasicMaterial({color:0xFF00FF, transparent: false});
const pointerMaterial = new MeshBasicMaterial({color: 0x00FF00, transparent: false});

const intializePointer = controller=>{
	const g = new Geometry();
	g.vertices.push( new Vector3(0,0,-2.5) );
	g.vertices.push( new Vector3(0,0,0) );

	const geometry = new CircleGeometry(0.002, 12);
	const cursor = new Mesh(geometry, pointerMaterial);

	controller.add(cursor);

	controller.add(new Line( g, laserMaterial ));
    controller.cursor = cursor;

}

const addTouchControllerModel = (controller, side)=> {
    const gltfFile = `./models/oculustouch/oculus-touch-controller-gen2-${side}.gltf`;
    const loader = new GLTFLoader();
    loader.load(
        gltfFile,
        gltf => {
            controller.add( gltf.scene );
        },
        xhr => {
            // console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
        },
        error => {
            console.log( error );
        }
    );
}
