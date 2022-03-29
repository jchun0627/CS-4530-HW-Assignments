import React, { useEffect, useState } from 'react';
import { Box, Heading, ListItem, UnorderedList } from '@chakra-ui/react';
import useConversationAreas from '../../hooks/useConversationAreas';
import PlayerName from './PlayerName';
import usePlayersInTown from '../../hooks/usePlayersInTown';
import ConversationArea, { ConversationAreaListener, NO_TOPIC_STRING } from '../../classes/ConversationArea';


/**
 * Displays a list of "active" conversation areas, along with their occupants 
 * 
 * A conversation area is "active" if its topic is not set to the constant NO_TOPIC_STRING that is exported from the ConverationArea file
 * 
 * If there are no active conversation areas, it displays the text "No active conversation areas"
 * 
 * If there are active areas, it sorts them by label ascending, using a numeric sort with base sensitivity
 * 
 * Each conversation area is represented as a Box:
 *  With a heading (H3) `{conversationAreaLabel}: {conversationAreaTopic}`,
 *  and an unordered list of occupants.
 * 
 * Occupants are *unsorted*, appearing in the order 
 *  that they appear in the area's occupantsByID array. Each occupant is rendered by a PlayerName component,
 *  nested within a ListItem.
 * 
 * Each conversation area component must subscribe to occupant updates by registering an `onOccupantsChange` listener on 
 *  its corresponding conversation area object.
 * It must register this listener when it is mounted, and remove it when it unmounts.
 * 
 * See relevant hooks: useConversationAreas, usePlayersInTown.
 */
 type ConversationAreaComponentProps = {
  conversationArea: ConversationArea
}


export function ConvoAreaComponent({conversationArea}: ConversationAreaComponentProps): JSX.Element {
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
  }, [conversationArea])

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
export default function ConversationAreasList(): JSX.Element {
  const conversationAreaList = useConversationAreas().filter(area => area.topic !== NO_TOPIC_STRING);
  
  if (conversationAreaList.length === 0){
    return <div>No active conversation areas</div>
  }

  return (
    <>
      {conversationAreaList.map(
        convoArea =>        
            <ConvoAreaComponent key={convoArea.label} conversationArea={convoArea}/> 
      )}
    </>
    )}
    
    