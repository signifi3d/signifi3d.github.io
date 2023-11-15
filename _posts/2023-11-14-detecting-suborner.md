---
layout: post
title:  "Detecting Suborner"
date:   2023-11-14 17:30:00 +0100
---

In the constant quest for ~~the fountain of youth~~ detection coverage I am frequently ~~stealing~~ reviewing the work of others. During one such recent dive, I found a lovely wiki page on the [Persistence Sniper](https://github.com/last-byte/PersistenceSniper/wiki/3---Detections) repo devoted to explaining and providing sources for the various persistence procedures it seeks out. It contains a buffet of the usual registry suspects, scheduled tasks, service creations, etc. But one that caught my eye, and must have somehow got lost in the firehose of constant security news, was the [Suborner Technique](https://r4wsec.com/notes/the_suborner_attack/).        
<br />
### What does it do?

Released by the same Windows authorization explorer that brought us [RID Hijacking](https://r4wsec.com/notes/rid_hijacking/index.html), Sebastian Castro ([@r4wd3r](https://infosec.exchange/@r4wd3r)), this technique promises to provide an invisible account for persistent access. Or, at least, a hard to see one that doesn't generate typical Windows Security Auditing events like id [4720](https://learn.microsoft.com/en-us/windows/security/threat-protection/auditing/event-4720).

<br />
It depends on a mix including a built-in behavior to hide accounts with a dollar sign in the name, RID Hijacking, and good ol' SYSTEM permissions. Particularly, it creates a new machine account without calling any account-specific API calls by directly creating and editing keys in the SAM registry, thus the SYSTEM permissions. And this will be what I take particular interest in: the registry activity.

<br />
This is a very shallow look at a fun technique. Please check out the original blog post linked above to get a full understanding of what this does under the hood.

<br />
### What do we see?
Based on the article and browsing the source code, I am hypothesizing that the key to this detection will be the registry activity in the `HKLM\SAM\SAM\Domains\Accounts\Users\Names` key. Those sorts of events can be monitored using [Sysmon](https://learn.microsoft.com/en-us/sysinternals/downloads/sysmon) ids 12 or 13 and also potentially with registry auditing events like ids [4663](https://learn.microsoft.com/en-us/windows/security/threat-protection/auditing/event-4663) and [4657](https://learn.microsoft.com/en-us/windows/security/threat-protection/auditing/event-4657), but I'll be mostly focusing on the Sysmon events.

<br />
Searching across historical baseline data for any activity interestingly, even just in the SAM registry, doesn't return any hits. This means one of two things to me: Events around these registry keys are suspicious enough on their own or I have a visibility problem with the available telemetry. So, let's try it out in the lab and see. 

<br />
The POC works exactly as advertised, and as simply as downloading the latest release and running it as SYSTEM. Then, sure enough, this is what we see (Note: I sort time ascending):

<br />
![Suborner Records](/images/suborner.png)

<br />
### What do we do?
Let's walk through some of the possible detections available here. With the related process creation event we can see the relevant executable and the parameters used. Detecting on any of these would likely be the weakest of detections. Executable names and hashes can be easily changed and the parameter names both aren't weak enough and aren't necessarily required for execution, so they make a bad signature of usage. On top of this, we are only looking at execution of a POC. This process could be built into custom tools and the technique could possibly even be executed using LOLBins. 

<br />
Up next we actually have a rather interesting set of events where the Suborner POC writes a txt file in the `C:\Windows\Tasks` directory and then imports the contents of it into the registry using `regedit.exe`. It seems obvious that @r4wd3r didn't want the POC itself to be too stealthy, because this alone should trip alarms. Possible detections would include auditing file creations in `C:\Windows\Tasks`, especially from suspicious executables, and regedit silent imports. The weakness of these detections in this case would be that it's entirely possible to perform this technique without using `regedit.exe` or writing a file at all, much less in `C:\Windows\Tasks`. One also might want to detect the naming pattern used as well (\[username\]\[RID\])  if specifically trying to target usage of the POC, but this wouldn't be difficult to change.

<br />
This finally leaves us with the registry events I anticipated earlier, `regedit.exe` creating and setting values in `HKLM\SAM\SAM\Domains\Account\Users`. It proves that we do have visibility into events around these keys, and the rarity of it suggests it as a low false positive detection. Good job everyone, let's go home. Right?

<br />
I was bothered by something. Why do I only see this activity and nothing else with these registry keys? Surely something else is doing something with them. I reviewed my Sysmon config, based off the [SwiftOnSecurity sysmon config](https://github.com/SwiftOnSecurity/sysmon-config/blob/master/sysmonconfig-export.xml), and what I found was that this registry key wasn't covered by the RegistryEvent includes, but any activity from `regedit.exe` was. So, the only reason I was even able to see these events was because they happened to use regedit, which isn't necessary to execute the technique.

<br />
After remedying my Sysmon config, I caught more events related to the Suborner activity. Following regedit we see the Suborner binary setting values in the same keys as well. I also found more events surrounding this key from `lsass.exe`, so I added that as an exclusion in the config as well. It could be argued that I would then lose visibility to someone using this technique in some code injected into lsass, but that's an edge case I'm willing to risk and leave to other detections. Otherwise, auditing suspicious process access to `HKLM\SAM\SAM\Domains\Account\Users` should suffice as an effective detection that may require minor tuning depending on what's normal in your environment.
