
import {PointerLockControls} from '../utils/PointerLockControls';
import {camera} from './threeManager';
import cameraPhysics from './cameraPhysics'

let pointerLock = null;

let forwards = false;
let strafe = false;
let jump = false;

export const init = ()=>{
    pointerLock = new PointerLockControls( camera, document.body );

    setupKeyboardEvents();

    document.body.addEventListener('click', ()=>{
        pointerLock.lock();
    })
}

const setupKeyboardEvents = ()=>{
    const xListener = (ev, keyDown) => {
        switch (ev.key) {
            case 'ArrowUp':
            case 'w':
                forwards = Number(keyDown);
                break;
            case 'ArrowDown':
            case 's':
                forwards = -Number(keyDown);
                break;
            case 'ArrowLeft':
            case 'a':
                strafe = -Number(keyDown);
                break;
            case 'ArrowRight':
            case 'd':
                strafe = Number(keyDown);
                break;
            case 'q':
                cameraPhysics.panRight(1);
                break;
            case 'e':
                cameraPhysics.panRight(-1);
                break;
            case ' ':
                jump = keyDown;
                break;
        }
    }
    const keyDown = e => { xListener(e, true) };
    const keyUp = e => { xListener(e, false) };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
}

export const update = ()=>{
	Object.assign(cameraPhysics, {forwards, strafe, jump});
}
