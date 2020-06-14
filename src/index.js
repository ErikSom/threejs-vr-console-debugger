import * as threeManager from './components/threeManager'
import * as desktopController from './components/desktopController'
import * as vrController from './components/vrController'
import * as vrDebugger from './components/vrDebugger'
import cameraPhysics from './components/cameraPhysics';


const init = ()=>{
    threeManager.init();
    threeManager.events.addEventListener('tick', update);

    cameraPhysics.object.position.set( 0, 300.0, 0 );

    desktopController.init();
    vrDebugger.init();
    vrController.init();
}
const update = (e)=>{
    desktopController.update();
    vrController.update();

    cameraPhysics.update(e.delta, threeManager.collisionObjects)
    vrDebugger.update();
}
init();
