import React, { useEffect, useState } from 'react';
import { Box, Heading, ListItem, OrderedList, UnorderedList } from '@chakra-ui/react';
import PlayerName from './PlayerName';
import usePlayersInTown from '../../hooks/usePlayersInTown';
import ConversationArea, { ConversationAreaListener } from '../../classes/ConversationArea';


type ConversationAreaComponentProps = {
    conversationArea: ConversationArea
}


export default function ConversationAreaComponent({conversationArea}: ConversationAreaComponentProps): JSX.Element {
  const [occupants, setOccupants] = useState<string[]>(conversationArea.occupants)
  const players = usePlayersInTown();

    useEffect(() => {
      const onOccupantsChangeListener : ConversationAreaListener = {
        onOccupantsChange:(newOccupants: string[] | undefined) => {
        if (newOccupants){
          setOccupants(newOccupants)
        }
      }} 
      conversationArea.addListener(onOccupantsChangeListener)
      return () =>{
      conversationArea.removeListener(onOccupantsChangeListener)
      }
    }, [])

    return (             
    <Box>
        <Heading role='heading' aria-label='heading' as='h3'>
            {conversationArea.label}: {conversationArea.topic}
         </Heading>
    <UnorderedList>
      {occupants.map(occupantID =>
        players.map(player => (
          <>
            {player.id === occupantID && (
              <ListItem role='listitem' key={player.id}>
                <PlayerName player={player} />
              </ListItem>
            )}
          </>
        )),
      )}
    </UnorderedList>
  </Box>
    
    )}