import { nanoid } from 'nanoid';
import { mock, mockDeep, mockReset } from 'jest-mock-extended';
import { Socket } from 'socket.io';
import TwilioVideo from './TwilioVideo';
import Player from '../types/Player';
import CoveyTownController from './CoveyTownController';
import CoveyTownListener from '../types/CoveyTownListener';
import { UserLocation } from '../CoveyTypes';
import PlayerSession from '../types/PlayerSession';
import { conversationAreaCreateHandler, townSubscriptionHandler } from '../requestHandlers/CoveyTownRequestHandlers';
import CoveyTownsStore from './CoveyTownsStore';
import * as TestUtils from '../client/TestUtils';

const mockTwilioVideo = mockDeep<TwilioVideo>();
jest.spyOn(TwilioVideo, 'getInstance').mockReturnValue(mockTwilioVideo);

function generateTestLocation(): UserLocation {
  return {
    rotation: 'back',
    moving: Math.random() < 0.5,
    x: Math.floor(Math.random() * 100),
    y: Math.floor(Math.random() * 100),
  };
}

describe('CoveyTownController', () => {
  beforeEach(() => {
    mockTwilioVideo.getTokenForTown.mockClear();
  });
  it('constructor should set the friendlyName property', () => { 
    const townName = `FriendlyNameTest-${nanoid()}`;
    const townController = new CoveyTownController(townName, false);
    expect(townController.friendlyName)
      .toBe(townName);
  });
  describe('addPlayer', () => { 
    it('should use the coveyTownID and player ID properties when requesting a video token',
      async () => {
        const townName = `FriendlyNameTest-${nanoid()}`;
        const townController = new CoveyTownController(townName, false);
        const newPlayerSession = await townController.addPlayer(new Player(nanoid()));
        expect(mockTwilioVideo.getTokenForTown).toBeCalledTimes(1);
        expect(mockTwilioVideo.getTokenForTown).toBeCalledWith(townController.coveyTownID, newPlayerSession.player.id);
      });
  });
  describe('town listeners and events', () => {
    let testingTown: CoveyTownController;
    const mockListeners = [mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>()];
    beforeEach(() => {
      const townName = `town listeners and events tests ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
      mockListeners.forEach(mockReset);
    });
    it('should notify added listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);
      const newLocation = generateTestLocation();
      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.updatePlayerLocation(player, newLocation);
      mockListeners.forEach(listener => expect(listener.onPlayerMoved).toBeCalledWith(player));
    });
    it('should notify added listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.destroySession(session);
      mockListeners.forEach(listener => expect(listener.onPlayerDisconnected).toBeCalledWith(player));
    });
    it('should notify added listeners of new players when addPlayer is called', async () => {
      mockListeners.forEach(listener => testingTown.addTownListener(listener));

      const player = new Player('test player');
      await testingTown.addPlayer(player);
      mockListeners.forEach(listener => expect(listener.onPlayerJoined).toBeCalledWith(player));

    });
    it('should notify added listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.disconnectAllPlayers();
      mockListeners.forEach(listener => expect(listener.onTownDestroyed).toBeCalled());

    });
    it('should not notify removed listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const newLocation = generateTestLocation();
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.updatePlayerLocation(player, newLocation);
      expect(listenerRemoved.onPlayerMoved).not.toBeCalled();
    });
    it('should not notify removed listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerDisconnected).not.toBeCalled();

    });
    it('should not notify removed listeners of new players when addPlayer is called', async () => {
      const player = new Player('test player');

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      const session = await testingTown.addPlayer(player);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerJoined).not.toBeCalled();
    });

    it('should not notify removed listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.disconnectAllPlayers();
      expect(listenerRemoved.onTownDestroyed).not.toBeCalled();

    });
  });
  describe('townSubscriptionHandler', () => {
    const mockSocket = mock<Socket>();
    let testingTown: CoveyTownController;
    let player: Player;
    let session: PlayerSession;
    beforeEach(async () => {
      const townName = `connectPlayerSocket tests ${nanoid()}`;
      testingTown = CoveyTownsStore.getInstance().createTown(townName, false);
      mockReset(mockSocket);
      player = new Player('test player');
      session = await testingTown.addPlayer(player);
    });
    it('should reject connections with invalid town IDs by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(nanoid(), session.sessionToken, mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    it('should reject connections with invalid session tokens by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, nanoid(), mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    describe('with a valid session token', () => {
      it('should add a town listener, which should emit "newPlayer" to the socket when a player joins', async () => {
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        townSubscriptionHandler(mockSocket);
        await testingTown.addPlayer(player);
        expect(mockSocket.emit).toBeCalledWith('newPlayer', player);
      });
      it('should add a town listener, which should emit "playerMoved" to the socket when a player moves', async () => {
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        townSubscriptionHandler(mockSocket);
        testingTown.updatePlayerLocation(player, generateTestLocation());
        expect(mockSocket.emit).toBeCalledWith('playerMoved', player);

      });
      it('should add a town listener, which should emit "playerDisconnect" to the socket when a player disconnects', async () => {
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        townSubscriptionHandler(mockSocket);
        testingTown.destroySession(session);
        expect(mockSocket.emit).toBeCalledWith('playerDisconnect', player);
      });
      it('should add a town listener, which should emit "townClosing" to the socket and disconnect it when disconnectAllPlayers is called', async () => {
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        townSubscriptionHandler(mockSocket);
        testingTown.disconnectAllPlayers();
        expect(mockSocket.emit).toBeCalledWith('townClosing');
        expect(mockSocket.disconnect).toBeCalledWith(true);
      });
      describe('when a socket disconnect event is fired', () => {
        it('should remove the town listener for that socket, and stop sending events to it', async () => {
          TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
          townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            const newPlayer = new Player('should not be notified');
            await testingTown.addPlayer(newPlayer);
            expect(mockSocket.emit).not.toHaveBeenCalledWith('newPlayer', newPlayer);
          } else {
            fail('No disconnect handler registered');
          }
        });
        it('should destroy the session corresponding to that socket', async () => {
          TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
          townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            mockReset(mockSocket);
            TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
            townSubscriptionHandler(mockSocket);
            expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
          } else {
            fail('No disconnect handler registered');
          }

        });
      });
      it('should forward playerMovement events from the socket to subscribed listeners', async () => {
        TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, session.sessionToken, mockSocket);
        townSubscriptionHandler(mockSocket);
        const mockListener = mock<CoveyTownListener>();
        testingTown.addTownListener(mockListener);
        // find the 'playerMovement' event handler for the socket, which should have been registered after the socket was connected
        const playerMovementHandler = mockSocket.on.mock.calls.find(call => call[0] === 'playerMovement');
        if (playerMovementHandler && playerMovementHandler[1]) {
          const newLocation = generateTestLocation();
          player.location = newLocation;
          playerMovementHandler[1](newLocation);
          expect(mockListener.onPlayerMoved).toHaveBeenCalledWith(player);
        } else {
          fail('No playerMovement handler registered');
        }
      });
    });
  });
  describe('addConversationArea', () => {
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `addConversationArea test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });
    it('should add the conversation area to the list of conversation areas', ()=>{
      const newConversationArea = TestUtils.createConversationForTesting();
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      const areas = testingTown.conversationAreas;
      expect(areas.length).toEqual(1);
      expect(areas[0].label).toEqual(newConversationArea.label);
      expect(areas[0].topic).toEqual(newConversationArea.topic);
      expect(areas[0].boundingBox).toEqual(newConversationArea.boundingBox);
    });
    it('checks to see if the adjacent conversation area bounding boxes overlaps', () => {
      const conversationArea1 = TestUtils.createConversationForTesting({ boundingBox: { x: 10, y: 10, height: 10, width: 10 } });
      const result1 = testingTown.addConversationArea(conversationArea1);
      expect(result1).toBe(true);
      
      expect(testingTown.conversationAreas[0]).toBe(conversationArea1);
      expect(testingTown.conversationAreas.length).toBe(1);
    
      const conversationArea2 = TestUtils.createConversationForTesting({ boundingBox: { x: 20, y: 10, height: 15, width: 10 } });
      const result2 = testingTown.addConversationArea(conversationArea2);
      expect(result2).toBe(true);
      expect(testingTown.conversationAreas.length).toBe(2);
      expect(testingTown.conversationAreas[0]).toBe(conversationArea1);
      expect(testingTown.conversationAreas[1]).toBe(conversationArea2);
      
    });
    it('checks to see if a player is added to the bounding box of the new conversation area', async () => {

      const player1 = new Player(nanoid());
      await testingTown.addPlayer(player1);
      const player2 = new Player(nanoid());
      await testingTown.addPlayer(player2);

      const conversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 0, y: 0, height: 2, width: 2 } });
      const result = testingTown.addConversationArea(conversationArea);
      expect(result).toBe(true);
      expect(conversationArea.occupantsByID.length).toBe(2);
      expect(conversationArea.occupantsByID).toContain(player1.id);
      expect(conversationArea.occupantsByID).toContain(player2.id);
      expect(player1.activeConversationArea).toBe(conversationArea);
      expect(player2.activeConversationArea).toBe(conversationArea);

    });
    it('should not add a conversation area that overlaps with another conversation areas', () => {
      const conversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 10, y: 10, height: 5, width: 5 } });
      const result = testingTown.addConversationArea(conversationArea);
      expect(result).toBe(true);
      expect(testingTown.conversationAreas.length).toBe(1);
      expect(testingTown.conversationAreas[0]).toBe(conversationArea);
      const conversationArea2 = TestUtils.createConversationForTesting({ boundingBox: { x: 9, y: 10, height: 5, width: 5 } });
      const result2 = testingTown.addConversationArea(conversationArea2);
      expect(conversationArea2.boundingBox.x);
      expect(result2).toBe(false);
      expect(testingTown.conversationAreas[0]).toBe(conversationArea);
    });
    it('should not add any players who are to the right of the bounding box to the newly created conversation area', async () => {
      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 25,
        y: 15,
      };
      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      testingTown.updatePlayerLocation(player, newLocation);

     
      const ConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 15, y: 15, height: 10, width: 10 } });
      const result = testingTown.addConversationArea(ConversationArea);
      expect(result).toBe(true);
      expect(ConversationArea.occupantsByID.length).toBe(0);
      expect(player.activeConversationArea).toBeUndefined();
    });

    it('checks that the player is not in the left boundary of the conversation area', async () => {

      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 10,
        y: 15,
      };

      const player = new Player(nanoid());
      await testingTown.addPlayer(player);

      testingTown.updatePlayerLocation(player, newLocation);
      const convesationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 15, y: 15, height: 10, width: 10 } });
      const result = testingTown.addConversationArea(convesationArea);
      expect(result).toBe(true);
      expect(convesationArea.occupantsByID.length).toBe(0);
      expect(player.activeConversationArea).toBeUndefined();

    });

    it('checks that the player is not in the right boundary of the conversation area', async () => {
      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 20,
        y: 15,
      };
      const player = new Player(nanoid());
      await testingTown.addPlayer(player);

      testingTown.updatePlayerLocation(player, newLocation);

 
      const convesationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 15, y: 15, height: 10, width: 10 } });
      const result = testingTown.addConversationArea(convesationArea);
      expect(result).toBe(true);
      expect(convesationArea.occupantsByID.length).toBe(0);
      expect(player.activeConversationArea).toBeUndefined();

    });

    it('checks to see if a player is below the bounding box of a newly created conversation area ', async () => {

      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 15,
        y: 5,
      };
      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      testingTown.updatePlayerLocation(player, newLocation);

      const conversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 15, y: 15, height: 10, width: 10 } });
      const result = testingTown.addConversationArea(conversationArea);
      expect(result).toBe(true);
      expect(conversationArea.occupantsByID.length).toBe(0);
      expect(player.activeConversationArea).toBeUndefined();
    });

    it('checks that the player is not in the bottom boundary of the conversation area', async () => {

      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 15,
        y: 10,
      };
      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      testingTown.updatePlayerLocation(player, newLocation);

      const conversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 15, y: 15, height: 10, width: 10 } });
      const result = testingTown.addConversationArea(conversationArea);
      expect(result).toBe(true);
      expect(conversationArea.occupantsByID.length).toBe(0);
      expect(player.activeConversationArea).toBeUndefined();
    });

    it('checks to see if a player is on the boundary of the bounding box top in order to ensure they are not added to convo area', async () => {
      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 15,
        y: 20,
      };
      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      testingTown.updatePlayerLocation(player, newLocation);

      const conversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 15, y: 15, height: 10, width: 10 } });
      const result = testingTown.addConversationArea(conversationArea);
      expect(result).toBe(true);
      expect(conversationArea.occupantsByID.length).toBe(0);
      expect(player.activeConversationArea).toBeUndefined();
    });
    it('ensures that a conversation area is not added if the same label exists', () => {
      const conversationArea = TestUtils.createConversationForTesting({ conversationLabel: 'conversationArea', boundingBox: { x: 10, y: 10, height: 5, width: 5 } });
      const result = testingTown.addConversationArea(conversationArea);
      expect(result).toBe(true);
      expect(testingTown.conversationAreas[0]).toBe(conversationArea);
      expect(testingTown.conversationAreas.length).toBe(1);

      const anotherConversationArea = TestUtils.createConversationForTesting({ conversationLabel: 'conversationArea', boundingBox: { x: 15, y: 15, height: 5, width: 5 } });
      const result2 = testingTown.addConversationArea(anotherConversationArea);
      expect(result2).toBe(false);
      expect(testingTown.conversationAreas[0]).toBe(conversationArea);
      expect(testingTown.conversationAreas.length).toBe(1);
    });
  });
  describe('updatePlayerLocation', () =>{
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `updatePlayerLocation test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });
    it('should respect the conversation area reported by the player userLocation.conversationLabel, and not override it based on the player\'s x,y location', async ()=>{
      const newConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 10, y: 10, height: 5, width: 5 } });
      const movedConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 30, y: 30, height: 5, width: 5 } });
      const movedToAnotherConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 60, y: 60, height: 5, width: 5 } });
      const resultNotMoved = testingTown.addConversationArea(newConversationArea);
      const resultMoved = testingTown.addConversationArea(movedConversationArea);
      const resultMovedAgain = testingTown.addConversationArea(movedToAnotherConversationArea);
      expect(resultNotMoved).toBe(true);
      expect(resultMoved).toBe(true);
      expect(resultMovedAgain).toBe(true);
      const player = new Player(nanoid());
      await testingTown.addPlayer(player);

      const newLocation:UserLocation = { moving: false, rotation: 'front', x: 30, y: 30, conversationLabel: movedConversationArea.label };
      testingTown.updatePlayerLocation(player, newLocation);
      expect(player.activeConversationArea?.label).toEqual(movedConversationArea.label);
      expect(player.activeConversationArea?.topic).toEqual(movedConversationArea.topic);
      expect(player.activeConversationArea?.boundingBox).toEqual(movedConversationArea.boundingBox);

      const newLocationMoved:UserLocation = { moving: false, rotation: 'front', x: 60, y: 60, conversationLabel: movedToAnotherConversationArea.label };
      testingTown.updatePlayerLocation(player, newLocationMoved);
      expect(player.activeConversationArea?.label).toEqual(movedToAnotherConversationArea.label);
      expect(player.activeConversationArea?.topic).toEqual(movedToAnotherConversationArea.topic);
      expect(player.activeConversationArea?.boundingBox).toEqual(movedToAnotherConversationArea.boundingBox);
      
      

    }); 
    it('should emit an onConversationUpdated event when a conversation area gets a new occupant', async () =>{

      const newConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 10, y: 10, height: 5, width: 5 } });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      const newLocation:UserLocation = { moving: false, rotation: 'front', x: 25, y: 25, conversationLabel: newConversationArea.label };
      testingTown.updatePlayerLocation(player, newLocation);
      expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);

    });
    it('should emit an onPlayerMoved event when a conversation area gets a new occupant', async () =>{

      const newConversationArea = TestUtils.createConversationForTesting({ boundingBox: { x: 10, y: 10, height: 5, width: 5 } });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      const newLocation:UserLocation = { moving: false, rotation: 'front', x: 25, y: 25, conversationLabel: newConversationArea.label };
      testingTown.updatePlayerLocation(player, newLocation);
      expect(mockListener.onPlayerMoved).toHaveBeenCalledTimes(1);


    });
    it('it should ensure that the onPlayerMoved method has been emited when the players location has been updated', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 10, y: 10, height: 5, width: 5 },
      });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const player = new Player(nanoid());
      await testingTown.addPlayer(player);

      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 25,
        y: 25,
        conversationLabel: newConversationArea.label,
      };
      testingTown.updatePlayerLocation(player, newLocation);
      expect(mockListener.onPlayerMoved).toHaveBeenCalledTimes(1);
    });
    it('it should ensure that the conversationArea list reflects player transitions from conversationAreas', async () => {
      const oldConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 10, y: 10, height: 5, width: 5 },
      });
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 25, y: 25, height: 5, width: 5 },
      });
      const addOldConversationAreaResult = testingTown.addConversationArea(oldConversationArea);
      expect(addOldConversationAreaResult).toBe(true);
    
      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      
      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 9,
        y: 9,
        conversationLabel: oldConversationArea.label,
      };

      const updateLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 24,
        y: 24,
        conversationLabel: newConversationArea.label,
      };

      const updateLocationOutsideConversationArea: UserLocation = {
        moving: true,
        rotation: 'front',
        x: 0,
        y: 0,
      };

      testingTown.updatePlayerLocation(player, newLocation);
      expect(player.activeConversationArea?.label).toEqual(oldConversationArea.label);
      expect(testingTown.conversationAreas[0].occupantsByID[0]).toEqual(player.id);

      const addNewConversationAreaResult = testingTown.addConversationArea(newConversationArea);
      expect(addNewConversationAreaResult).toBe(true);

      testingTown.updatePlayerLocation(player, updateLocation);
      expect(player.activeConversationArea?.label).toEqual(newConversationArea.label);
      expect(testingTown.conversationAreas.length).toEqual(1);
      expect(testingTown.conversationAreas[0].occupantsByID[0]).toEqual(player.id);
      expect(mockListener.onConversationAreaDestroyed).toHaveBeenCalledTimes(1);
      expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(3);



      
      testingTown.updatePlayerLocation(player, updateLocationOutsideConversationArea);
      expect(player.activeConversationArea).toBeUndefined();
      expect(testingTown.conversationAreas.length).toEqual(0);
      

    });

    it('checks to see if the player has been removed', async () => {

      const oldConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 10, y: 10, height: 5, width: 5 },
      });
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 25, y: 25, height: 5, width: 5 },
      });


      const OldConversationAreaResult = testingTown.addConversationArea(oldConversationArea);
      expect(OldConversationAreaResult).toBe(true);
      const newConversationAreaResult = testingTown.addConversationArea(newConversationArea);
      expect(newConversationAreaResult).toBe(true);

      
      const player1 = new Player(nanoid());
      const player2 = new Player(nanoid());
      await testingTown.addPlayer(player1);
      await testingTown.addPlayer(player2);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 9,
        y: 9,
        conversationLabel: oldConversationArea.label,
      };

      const updateLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 24,
        y: 24,
        conversationLabel: newConversationArea.label,
      };

      

      testingTown.updatePlayerLocation(player1, newLocation);
      expect(player1.activeConversationArea?.label).toEqual(oldConversationArea.label);
      expect(testingTown.conversationAreas[0].occupantsByID[0]).toEqual(player1.id);

      testingTown.updatePlayerLocation(player2, newLocation);
      expect(player2.activeConversationArea?.label).toEqual(oldConversationArea.label);
      expect(testingTown.conversationAreas[0].occupantsByID.length).toEqual(2);
      expect(testingTown.conversationAreas[0].occupantsByID[1]).toEqual(player2.id);


      testingTown.updatePlayerLocation(player1, updateLocation);
      expect(player1.activeConversationArea?.label).toEqual(newConversationArea.label);
      expect(testingTown.conversationAreas[0].occupantsByID.find(player => player1.id === player)).toBe(undefined);
      expect(testingTown.conversationAreas[1].occupantsByID[0]).toEqual(player1.id);
      expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(4);

    });
    it('checks to see if the conversation area is still present after player moving location', async () => {

      const ConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 10, y: 10, height: 5, width: 5 },
      });


      const ConversationAreaResult = testingTown.addConversationArea(ConversationArea);
      expect(ConversationAreaResult).toBe(true);

      
      const player1 = new Player(nanoid());
      await testingTown.addPlayer(player1);


      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 9,
        y: 9,
        conversationLabel: ConversationArea.label,
      };

      const updateLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 7,
        y: 8,
        conversationLabel: ConversationArea.label,
      };

      testingTown.updatePlayerLocation(player1, newLocation);
      expect(player1.activeConversationArea?.label).toEqual(ConversationArea.label);
      testingTown.updatePlayerLocation(player1, updateLocation);
      expect(player1.activeConversationArea?.label).toEqual(ConversationArea.label);
      expect(testingTown.conversationAreas[0].occupantsByID.find(occupants => occupants === player1.id)).toEqual(player1.id);


    });
    it('checks to see if a player can not be moved into a conversation area already destroyed', async () => {

      const ConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 10, y: 10, height: 5, width: 5 },
      });


      const ConversationAreaResult = testingTown.addConversationArea(ConversationArea);
      expect(ConversationAreaResult).toBe(true);

      
      const player1 = new Player(nanoid());
      await testingTown.addPlayer(player1);


      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 9,
        y: 9,
        conversationLabel: ConversationArea.label,
      };

      const updateLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 7,
        y: 8,
      };

      testingTown.updatePlayerLocation(player1, newLocation);
      expect(player1.activeConversationArea?.label).toEqual(ConversationArea.label);
      testingTown.updatePlayerLocation(player1, updateLocation);
      expect(player1.activeConversationArea?.label).toBeUndefined();





    });

  });
  describe('destroySession', () => {
    let testingTown: CoveyTownController;
    beforeEach(async () => {
      const townName = `connectPlayerSocket tests ${nanoid()}`;
      testingTown = CoveyTownsStore.getInstance().createTown(townName, false);
    });
    it('should remove from the conversation area when player session is destroyed', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 10, y: 10, height: 5, width: 5 },
      });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const player = new Player(nanoid());
      const session = await testingTown.addPlayer(player);
      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 25,
        y: 25,
        conversationLabel: newConversationArea.label,
      };
      testingTown.updatePlayerLocation(player, newLocation);
      expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);

      testingTown.destroySession(session);
      const playerFound = newConversationArea.occupantsByID.find(
        player_id => player_id === player.id,
      );
      expect(playerFound).toBeUndefined();
    });
  });
});
