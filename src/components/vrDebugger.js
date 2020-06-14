import {
    VRConsoleDebugger
} from '../utils/VRConsoleDebugger'

import {
    Raycaster,
    Vector3,
    Quaternion,
    Matrix4
} from "three";

import { camera, gl, spawnBox } from './threeManager'
import cameraPhysics from './cameraPhysics'


const raycaster = new Raycaster();
raycaster.far = 10.0;

const raycastDestination = new Vector3();
const localZero = new Vector3();

let controllers = [];
let sessionStarted = false;
const vec = new Vector3();
const quat = new Quaternion();
const mx = new Matrix4();

export let vrConsoleDebugger = null
export const init = () => {
    vrConsoleDebugger = new VRConsoleDebugger(gl);
    initControllers(gl);

    gl.xr.addEventListener('sessionstart', ()=>{
        sessionStarted = true;
    });

    vrConsoleDebugger.keyboard.assignScriptToFunctionKey(1, ()=>{

        const controller = vrConsoleDebugger.object.parent;

        vec.set(0, 0.0, -6.0);
        controller.getWorldQuaternion(quat);
        vec.applyQuaternion(quat);
        vec.add(controller.getWorldPosition(new Vector3()));

        const box = spawnBox(null, {position:vec.toArray()});
        box.material.color.setHex(Math.random()*0xffffff);
        console.log(box);
    })

    console.log('CAMERA:');
    console.log(camera);
    console.log('CAMERA PHYSICS:')
    console.log(cameraPhysics);
}

const getControllerObjectRayIntersections = (controllerObject) => {
    raycastDestination.set(0, 0, -1);
    controllerObject.getWorldQuaternion(quat)
    raycastDestination.applyQuaternion(quat);

    localZero.set(0,0,0);
    controllerObject.localToWorld(localZero);

    raycaster.set(localZero, raycastDestination);
    return raycaster.intersectObjects(vrConsoleDebugger.interactiveObjects, true);
}

const initControllers = (gl) => {
    controllers = [gl.xr.getController( 0 ), gl.xr.getController( 1 )];
    const setSelectDown = (e, down) => {
        const intersections = getControllerObjectRayIntersections(e.target);
        for (let object of vrConsoleDebugger.interactiveObjects) {
            if (object.scrollable) {
                object.isSelected = null;
            }
        }
        for (let intersect of intersections) {
            if (down) {
                if (intersect.object.scrollable) {
                    intersect.object.isSelected = e.target;
                    intersect.object.localIntersectionPoint = intersect.object.worldToLocal(intersect.point.clone());
                    break;
                }
                if (intersect.object.select) {
                    intersect.object.select(intersect);
                    break;
                }
            }
        }
    }
    const selectDown = e => {
        setSelectDown(e, true)
    };
    const selectUp = e => {
        setSelectDown(e, false)
    };

    controllers[0].addEventListener('selectstart', selectDown);
    controllers[0].addEventListener('selectend', selectUp);
    controllers[1].addEventListener('selectstart', selectDown);
    controllers[1].addEventListener('selectend', selectUp);
}

export const update = () => {
    let object;
    controllers.forEach((controller) => {
        const intersections = getControllerObjectRayIntersections(controller);
        for (let intersect of intersections) {

            object = intersect.object;
            if (object.isSelected === controller) {
                if (object.scrollable) {
                    const localIntersection = object.worldToLocal(intersect.point.clone());
                    const localDrag = localIntersection.clone().sub(object.localIntersectionPoint);
                    object.localIntersectionPoint = localIntersection;
                    object.scroll(localDrag.y);
                }
            }
            if (object.hover) {
                object.hover(intersect);
            }
        }
    });

    if(!sessionStarted) return;

    const shakesToOpen = 10;
    const shakeResetTime = 200;
    //detect shakes
    controllers.forEach((controller) => {

        if(controller.shakePreviousPosition){
            const posDif = controller.position.clone().sub(controller.shakePreviousPosition);

            const doResetShakeTimer = ()=>{
                if(controller.resetShakeTimeout){
                    clearTimeout(controller.resetShakeTimeout);
                }
                controller.resetShakeTimeout = setTimeout(()=>{
                    controller.previousQuat = undefined;
                }, shakeResetTime);
            }

            const minimumMovement = 0.03;

            if(posDif.length() > minimumMovement){

                const mx = new Matrix4().lookAt(posDif.clone().normalize(),new Vector3(0,0,0),new Vector3(0,1,0));
                const quat = new Quaternion().setFromRotationMatrix(mx);

                if(!controller.previousQuat) {
                    controller.shakes = 0;
                    controller.previousQuat = quat;
                    doResetShakeTimer();
                } else{
                    const angleTolerance = 1.0;
                    if(controller.previousQuat.angleTo(quat) > Math.PI-angleTolerance){
                        controller.shakes++;
                        if(controller.shakes === shakesToOpen){
                            controller.previousQuat = null;
                            vrConsoleDebugger.addToObject(controller);
                        }

                        doResetShakeTimer();
                    }
                }
            }
        }
        controller.shakePreviousPosition = controller.position.clone();
    });

}
