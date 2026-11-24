# Runetracker Privacy Policy

**Last updated: November 25, 2026**

This Privacy Policy explains how Runetracker handles information when you use
the Runetracker Discord bot and its related API. Runetracker is an independent
community project operated by its maintainer. For privacy questions or requests,
contact the team through [the Runetracker Discord](https://runetracker.icu/discord).

## 1. Information the Service handles

To operate the bot, Runetracker may store:

- Discord server (guild) IDs and the configured notification-channel ID.
- Discord user IDs for people a server administrator designates as bot admins.
- OSRS usernames and Wise Old Man player IDs for tracked players.
- Game snapshots, such as skill levels and XP, boss kill counts, clue scores,
  achievements, and the time a snapshot was updated.
- Linked Wise Old Man group details, notification preferences, spam-filter
  thresholds, cooldown timestamps, and weekly leaderboard state.
- The message ID and delivery status of a one-time service announcement.

The bot processes Discord slash-command and component interactions to perform
requested actions. It uses Discord's Guilds intent and does not need the
message-content intent to read or monitor server chat. When debug logging is
enabled, logs may include a command name, server ID, and the acting user's
Discord tag. Error logs may also contain information needed to diagnose a
failure.

## 2. How information is used

Information is used to provide tracking and notifications, maintain server
settings and player snapshots, produce leaderboards and site statistics,
prevent excessive notifications, secure and troubleshoot the Service, and
respond to support or deletion requests.

## 3. Third-party services

When a player is tracked or refreshed, the Service may send that player's OSRS
username to the official OSRS Hiscores and/or Wise Old Man APIs to retrieve
public game statistics. The bot also uses Discord to receive commands and post
messages. These providers process information under their own terms and privacy
policies. Runetracker does not control their systems.

The bot's operator hosts the Service and its data using the configured hosting
provider. The provider may process technical information, such as connection
and operational logs, to run and secure its infrastructure.
The operator can access stored Service information for operation, security,
troubleshooting, and support.

## 4. Public website and API

The Runetracker site API can provide service summaries, Discord server names
and member counts, linked group names, player counts, command information, and
leaderboards containing tracked OSRS usernames and public game statistics.
Unless the operator configures `SITE_API_KEY`, these API responses may be
publicly accessible. Do not configure tracking or publish information that you
do not want shown through the site's public data.

The website is hosted separately from this bot repository. Its hosting or
website implementation may process standard web-request information or use
cookies; refer to any notices provided on the website and by its host.

## 5. Storage and retention

Guild settings and player snapshots are stored in files under the bot's
configured `DATA_DIR`. The operator should use access controls and persistent
storage appropriate to the deployment.

Server administrators can remove a player from their server with `/untrack`.
Player snapshots are shared by WOM player ID across servers and are not
automatically deleted when a player is untracked from one server. They may
remain until the operator removes them. Guild configuration may also remain
after the bot leaves a server until the operator deletes it.

To request deletion of stored information, contact the Runetracker team through
the Discord link above and identify the relevant server or player. The operator
may need to verify the request and consider whether a shared snapshot is still
used by another server before deleting it.

## 6. Sharing and security

Runetracker does not sell tracked-player information or use it for targeted
advertising. Information is shared only as needed to operate the Service with
Discord, OSRS Hiscores, Wise Old Man, the hosting provider, and through the
public site/API described above.

Reasonable measures are used to protect stored information, but no online
service or storage system can be guaranteed completely secure.

## 7. Changes and contact

This Policy may be updated when the Service or its data practices change. The
"Last updated" date indicates the latest revision. Questions or requests can
be sent through [the Runetracker Discord](https://runetracker.icu/discord).
