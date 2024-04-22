/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findStoreLazy } from "@webpack";
import { GuildChannelStore, Menu, React, RestAPI, UserStore } from "@webpack/common";
import type { Channel } from "discord-types/general";

const VoiceStateStore = findStoreLazy("VoiceStateStore");

async function runSequential(promises: Promise<any>[]): Promise<any[]> {
    const results: any[] = [];
    for (const promise of promises) {
        const result = await promise;
        results.push(result);
    }

    return results;
}

function sendPatch(channel: Channel, body: Record<string, any>, bypass = false) {
    const usersVoice = VoiceStateStore.getVoiceStatesForChannel(channel.id); // Get voice states by channel id
    const myId = UserStore.getCurrentUser().id; // Get my user id

    const promises: Promise<any>[] = [];
    Object.keys(usersVoice).forEach((key, index) => {
        const userVoice = usersVoice[key];

        if (bypass || userVoice.userId !== myId) {
            promises.push(RestAPI.patch({
                url: `/guilds/${channel.guild_id}/members/${userVoice.userId}`,
                body: body
            }));
        }
    });

    runSequential(promises).catch(error => {
        console.error("VoiceChatUtilities failed to run", error);
    });
}

interface VoiceChannelContextProps {
    channel: Channel;
}

const VoiceChannelContext: NavContextMenuPatchCallback = (children, { channel }: VoiceChannelContextProps) => {
    // only for voice and stage channels
    if (!channel || (channel.type !== 2 && channel.type !== 13)) return;
    const userCount = Object.keys(VoiceStateStore.getVoiceStatesForChannel(channel.id)).length;
    if (userCount === 0) return;

    const guildChannels: { VOCAL: { channel: Channel, comparator: number }[] } = GuildChannelStore.getChannels(channel.guild_id);
    const voiceChannels = guildChannels.VOCAL.map(({ channel }) => channel).filter(({ id }) => id !== channel.id);

    children.splice(
        -1,
        0,
        <Menu.MenuItem
                label="Move All"
                key="voice-tools-move-all"
                id="voice-tools-move-all"
            >
                {voiceChannels.map(voiceChannel => {
                    return (
                        <Menu.MenuItem
                            key={voiceChannel.id}
                            id={voiceChannel.id}
                            label={voiceChannel.name}
                            action={() => sendPatch(channel, {
                                channel_id: voiceChannel.id,
                            }, true)}
                        />
                    );
                })}
        </Menu.MenuItem>
    );
};

export default definePlugin({
    name: "MoveEveryone",
    description: "originally by dutake",
    authors: [{ name: "TOR1MA", id: 342785667719495691n }, Devs.D3SOX],

    contextMenus: {
        "channel-context": VoiceChannelContext
    },
});

