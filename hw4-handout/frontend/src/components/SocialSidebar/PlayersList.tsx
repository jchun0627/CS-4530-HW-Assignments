import React from 'react';
import { Heading, Tooltip, ListItem, OrderedList} from '@chakra-ui/react'
import useCoveyAppState  from '../../hooks/useCoveyAppState';
import PlayerName from './PlayerName';
import usePlayersInTown from '../../hooks/usePlayersInTown';



/**
 * Lists the current players in the town, along with the current town's name and ID
 * 
 * Town name is shown in an H2 heading with a ToolTip that shows the label `Town ID: ${theCurrentTownID}`
 * 
 * Players are listed in an OrderedList below that heading, sorted alphabetically by userName (using a numeric sort with base precision)
 * 
 * Each player is rendered in a list item, rendered as a <PlayerName> component
 * 
 * See `usePlayersInTown` and `useCoveyAppState` hooks to find the relevant state.
 * 
 */


export default function PlayersInTownList(): JSX.Element {
const {currentTownID, currentTownFriendlyName} = useCoveyAppState();
const players = usePlayersInTown();
return (

    <>
    <Tooltip label={`Town ID: ${currentTownID}`} aria-label={`Town ID: ${currentTownID}`}>
      <Heading role='heading' as='h2' aria-label='heading'>Current town: {currentTownFriendlyName}</Heading>
    </Tooltip>
    <OrderedList spacing={3}> 
    {players.slice().sort((a, b) => {
          if(a.userName.toLocaleLowerCase() > b.userName.toLocaleLowerCase()) {
            return 1;
          }
          if (a.userName.toLocaleLowerCase() < b.userName.toLocaleLowerCase()) {
            return -1
          }
          return 0
        }).map(player => (
          <ListItem key={player.id}>
            <PlayerName player={player} />
          </ListItem>
        ))}
    </OrderedList>
    </>
  )
}