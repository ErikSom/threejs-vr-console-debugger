import {CameraPhysics} from '../utils/CameraPhysics';
import * as threeManager from './threeManager'

const { camera, scene } = threeManager;

export default cameraPhysics = new CameraPhysics(camera, scene);
