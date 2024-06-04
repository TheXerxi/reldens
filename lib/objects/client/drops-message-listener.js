/**
 *
 * Reldens - DropsMessageListener
 *
 */

const { ObjectsConst } = require('../constants');
const { Logger, sc } = require('@reldens/utils');

class DropsMessageListener
{

    static listenMessages(room, gameManager)
    {
        room.onMessage('*', (message) => {
            let drops = sc.get(message, ObjectsConst.DROPS.KEY, false);
            if(drops){
                this.loadObjects(drops, gameManager);
            }
            if(ObjectsConst.DROPS.REMOVE === message.act){
                this.removeDropById(message.id, gameManager);
            }
        });
    }

    static loadObjects(drops, gameManager)
    {
        let currentScene = gameManager.getActiveScene();
        let gameConfig = gameManager.config;
        let objectPlugin = gameManager.getFeature('objects');
        let loader = currentScene.load;
        if(!this.validateParams({currentScene, gameConfig, objectPlugin, loader})){
            return false;
        }
        for(let [dropId, drop] of Object.entries(drops)){
            this.loadSpritesheet(drop, loader, gameConfig);
            loader.once('complete', async (event) => {
                await this.createDropAnimation(objectPlugin, drop, dropId, currentScene);
            });
        }
        loader.start();
        return true;
    }

    static async createDropAnimation(objectsPlugin, drop, dropId, currentScene)
    {
        let dropAnimationData = {
            type: ObjectsConst.DROPS.PICK_UP_ACT,
            enabled: true,
            ui: true,
            frameStart: drop[ObjectsConst.DROPS.PARAMS]['start'],
            frameEnd: drop[ObjectsConst.DROPS.PARAMS]['end'],
            repeat: drop[ObjectsConst.DROPS.PARAMS]['repeat'],
            autoStart: true,
            key: dropId,
            id: dropId,
            targetName: '',
            layerName: dropId,
            isInteractive: true,
            asset_key: drop[ObjectsConst.DROPS.ASSET_KEY],
            x: drop.x,
            y: drop.y,
            yoyo: drop[ObjectsConst.DROPS.PARAMS]['yoyo']
        };
        return await objectsPlugin.createAnimationFromAnimData(dropAnimationData, currentScene);
    }

    static loadSpritesheet(drop, loader, gameConfig)
    {
        loader.spritesheet(
            drop[ObjectsConst.DROPS.ASSET_KEY],
            this.getSpritesheetPath(drop),
            this.getRewardFrameConfig(drop[ObjectsConst.DROPS.PARAMS], gameConfig)
        );
    }

    static getRewardFrameConfig(dropParams, gameConfig)
    {
        return {
            frameWidth: sc.get(
                dropParams,
                'frameWidth',
                gameConfig.getWithoutLogs('client/map/dropsTile/width', gameConfig.get('client/map/tileData/width'))
            ),
            frameHeight: sc.get(
                dropParams,
                'frameHeight',
                gameConfig.getWithoutLogs('client/map/dropsTile/height', gameConfig.get('client/map/tileData/height'))
            )
        };
    }

    static getSpritesheetPath(drop)
    {
        return ObjectsConst.DROPS.ASSETS_PATH + drop[ObjectsConst.DROPS.FILE];
    }

    static removeDropById(dropId, gameManager)
    {
        if(!dropId){
            return false;
        }
        let currentScene = gameManager.activeRoomEvents.getActiveScene();
        let dropAnimation = sc.get(currentScene.objectsAnimations, dropId, false);
        if(!dropAnimation){
            return false;
        }
        dropAnimation.sceneSprite.destroy();
        delete currentScene.objectsAnimations[dropId];
    }

    static validateParams(props)
    {
        let isValid = true;
        if(!sc.get(props, 'currentScene', false)){
            Logger.error('Scene is undefined in Rewards Message Listener.');
            isValid = false;
        }
        if(!sc.get(props, 'gameConfig', false)){
            Logger.error('Game Config is undefined in Rewards Message Listener.');
            isValid = false;
        }
        if(!sc.get(props, 'objectPlugin', false)){
            Logger.error('Object Plugin is undefined in Rewards Message Listener.');
            isValid = false;
        }
        if(!sc.get(props, 'loader', false)){
            Logger.error('Loader is undefined in Rewards Message Listener.');
            isValid = false;
        }
        return isValid;
    }
}

module.exports.DropsMessageListener = DropsMessageListener;
