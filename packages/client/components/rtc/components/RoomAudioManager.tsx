import { createEffect, createMemo } from "solid-js";
import { AudioTrack, useTracks } from "solid-livekit-components";

import { getTrackReferenceId, isLocal } from "@livekit/components-core";
import { Key } from "@solid-primitives/keyed";
import { RemoteTrackPublication, Track } from "livekit-client";

import { useState } from "@revolt/state";

import { useClient } from "@revolt/client";
import entrySound from "../../../assets/audio/entry_sound.wav";
import exitSound from "../../../assets/audio/exit_sound.mp3";
import groan_entry from "../../../assets/audio/groan_entry.m4a";
import groan_exit from "../../../assets/audio/groan_exit.m4a";
import { useVoice } from "../state";

export function RoomAudioManager() {
  const voice = useVoice();
  const state = useState();

  const client = useClient();

  const currentUser = client()!.user!.id;

  const voiceParticipantsUserIds: string[] = [];

  voice.channel()?.voiceParticipants.forEach((voiceParticipant) => {
    voiceParticipantsUserIds.push(voiceParticipant.userId);
  });

  const tracks = useTracks(
    [
      Track.Source.Microphone,
      Track.Source.ScreenShareAudio,
      Track.Source.Unknown,
    ],
    {
      updateOnlyOn: [],
      onlySubscribed: false,
    },
  );

  const filteredTracks = createMemo(() =>
    tracks().filter(
      (track) =>
        !isLocal(track.participant) &&
        track.publication.kind === Track.Kind.Audio,
    ),
  );

  createEffect(() => {
    const tracks = filteredTracks();
    console.info("[rtc] filtered tracks", filteredTracks());
    for (const track of tracks) {
      (track.publication as RemoteTrackPublication).setSubscribed(true);
      console.info(track.publication);
    }

    const voiceParticipants = voice.channel()?.voiceParticipants;

    console.log(voiceParticipantsUserIds, voiceParticipantsUserIds.length);
    console.log(voiceParticipants, voiceParticipants?.size);

    if (voiceParticipants === undefined) return;

    if (voiceParticipants?.size == voiceParticipantsUserIds.length) {
      console.log("No Changes to user list");
    } else if (voiceParticipants.size > voiceParticipantsUserIds.length) {
      console.log("User Joined");
      const joinedUser = voiceParticipants
        ?.values()
        .find(
          (voiceParticipant) =>
            voiceParticipantsUserIds.indexOf(voiceParticipant.userId) === -1,
        );

      if (joinedUser == undefined) return;

      console.log(currentUser);
      console.log(joinedUser.userId);

      if (joinedUser.userId !== currentUser) {
        console.log("Playing Entry Sound");
        const audioChoices = [entrySound, groan_entry];

        const choice = Math.floor(Math.random() * audioChoices.length);
        new Audio(audioChoices[choice]).play();
      }

      voiceParticipantsUserIds.push(joinedUser.userId);
    } else if (voiceParticipants.size < voiceParticipantsUserIds.length) {
      console.log("User Left");
      const leftUser = voiceParticipantsUserIds.find((userId) => {
        const user = voiceParticipants
          .values()
          .find((voiceParticipant) => voiceParticipant.userId === userId);

        return user === undefined || user === null;
      });

      if (leftUser == undefined) return;

      console.log(currentUser);
      console.log(leftUser);

      if (leftUser !== currentUser) {
        console.log("Playing Exit Sound");

        const audioChoices = [exitSound, groan_exit];

        const choice = Math.floor(Math.random() * audioChoices.length);
        new Audio(audioChoices[choice]).play();
      }

      voiceParticipantsUserIds.splice(
        voiceParticipantsUserIds.indexOf(leftUser),
        1,
      );
    }

    console.log("End", voiceParticipantsUserIds);
  });

  return (
    <div style={{ display: "none" }}>
      <Key each={filteredTracks()} by={(item) => getTrackReferenceId(item)}>
        {(track) => (
          <AudioTrack
            trackRef={track()}
            volume={
              state.voice.outputVolume *
              state.voice.getUserVolume(track().participant.identity)
            }
            muted={
              state.voice.getUserMuted(track().participant.identity) ||
              voice.deafen()
            }
            enableBoosting
          />
        )}
      </Key>
    </div>
  );
}
