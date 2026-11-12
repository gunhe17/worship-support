/** Presence 키와 채널 이름 (DB_SCHEMA §8.2). Hash와 Pub/Sub 채널이 같은 이름을 쓴다. */
export const presenceKeyOf = (templateId: string) => `presence:template:${templateId}`;
export const presenceChannelOf = presenceKeyOf;
