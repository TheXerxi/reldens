/**
 *
 * Reldens - RoomsManager
 *
 * This class will load the rooms information and define them in the server.
 *
 */

const { RoomsModel } = require('./model');
const { RoomGame } = require('./game');
const { RoomScene } = require('./scene');
const { GameConst } = require('../../game/constants');
const { Logger, ErrorManager, EventsManager } = require('@reldens/utils');

class RoomsManager
{

    constructor()
    {
        this.loadedRooms = false;
        this.loadedRoomsById = false;
        this.loadedRoomsByName = false;
        this.defineExtraRooms = [];
    }

    async defineRoomsInGameServer(gameServer, props)
    {
        EventsManager.emit('reldens.roomsDefinition', this.defineExtraRooms);
        if(!this.defineExtraRooms.length){
            Logger.info('None extra rooms to be defined.');
        }
        // dispatch event to get the global message actions (that will be listen by every room):
        let globalMessageActions = {};
        EventsManager.emit('reldens.roomsMessageActionsGlobal', globalMessageActions);
        // loaded rooms counter:
        let counter = 0;
        // lobby room:
        this.defineRoom(gameServer, GameConst.ROOM_GAME, RoomGame, props, globalMessageActions);
        Logger.info('Loaded game room using stored configuration.');
        // define extra rooms (if any, for example features rooms):
        if(this.defineExtraRooms){
            for(let roomData of this.defineExtraRooms){
                this.defineRoom(gameServer, roomData.roomName, roomData.room, props, globalMessageActions);
                counter++;
                Logger.info(`Loaded extra room: ${roomData.roomName}`);
            }
        }
        // load rooms data:
        let rooms = await this.loadRooms();
        // register room-scenes from database:
        for(let roomModel of rooms){
            let roomClass = RoomScene;
            if(roomModel.roomClassKey){
                let roomClassDefinition = props.config.get('server/customClasses/rooms/'+roomModel.room_class_key);
                if(!roomClassDefinition){
                    Logger.error([
                        'RoomsManager custom class not found.',
                        '- Room ID:', roomModel.id,
                        '- Custom class:', roomModel.room_class_key
                    ]);
                    continue;
                }
                roomClass = roomClassDefinition;
            }
            // define the room including all the props:
            this.defineRoom(gameServer, roomModel.roomName, roomClass, props, globalMessageActions, roomModel);
            counter++;
            Logger.info(`Loaded room: ${roomModel.roomName}`);
        }
        // log defined rooms:
        Logger.info(`Total rooms loaded: ${counter}`);
        return rooms;
    }

    defineRoom(gameServer, roomName, roomClass, props, globalMessageActions, roomModel = false)
    {
        let roomMessageActions = Object.assign({}, globalMessageActions);
        // run message actions event for each room:
        EventsManager.emit('reldens.roomsMessageActionsByRoom', roomMessageActions, roomName);
        // merge room data and props:
        let roomProps = {
            loginManager: props.loginManager,
            config: props.config,
            messageActions: roomMessageActions
        };
        if(roomModel){
            roomProps.roomData = roomModel;
        }
        gameServer.define(roomName, roomClass, roomProps);
    }

    async loadRooms()
    {
        // @TODO: this will change when hot-plug is introduced.
        if(!this.loadedRooms){
            // get rooms:
            let roomsModels = await RoomsModel.loadFullData();
            if(!roomsModels){
                ErrorManager.error('None rooms found in the database. A room is required to run.');
            }
            let rooms = [];
            let roomsById = {};
            let roomsByName = {};
            for(let room of roomsModels){
                let temp = this.generateRoomModel(room);
                rooms.push(temp);
                roomsById[room.id] = temp;
                roomsByName[room.name] = temp;
            }
            this.loadedRooms = rooms;
            this.loadedRoomsById = roomsById;
            this.loadedRoomsByName = roomsByName;
        }
        return this.loadedRooms;
    }

    async loadRoomById(roomId)
    {
        if(this.loadedRoomsById[roomId]){
            return this.loadedRoomsById[roomId];
        }
        let room = await RoomsModel.loadById(roomId);
        if(room){
            return this.generateRoomModel(room);
        }
        return false;
    }

    async loadRoomByName(roomName)
    {
        if(this.loadedRoomsByName[roomName]){
            return this.loadedRoomsByName[roomName];
        }
        let room = await RoomsModel.loadByName(roomName);
        if(room){
            return this.generateRoomModel(room);
        }
        return false;
    }

    generateRoomModel(room)
    {
        let temp = {
            roomId: room.id,
            roomName: room.name,
            roomTitle: room.title,
            roomMap: room.map_filename,
            sceneImages: room.scene_images,
            changePoints: [],
            returnPoints: [],
            roomClassPath: room.room_class_key
        };
        // assign to room:
        for(let changePoint of room.rooms_change_points){
            temp.changePoints.push({i: changePoint.tile_index, n: changePoint.next_room.name});
        }
        // assign to room:
        for(let returnPosition of room.rooms_return_points){
            // this array translates to D for direction, X and Y for positions, De for default and P for previous room.
            let toRoomName = returnPosition.to_room ? returnPosition.to_room.name : false;
            let posTemp = {D: returnPosition.direction, X: returnPosition.x, Y: returnPosition.y, P: toRoomName};
            if({}.hasOwnProperty.call(returnPosition, 'is_default') && returnPosition.is_default){
                posTemp.De = returnPosition.is_default;
            }
            temp.returnPoints.push(posTemp);
        }
        if(!temp.returnPoints.length){
            Logger.error(['None return points found for room:', temp.roomName, temp.roomId]);
        }
        return temp;
    }

}

module.exports.RoomsManager = RoomsManager;
