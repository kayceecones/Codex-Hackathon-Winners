# Project Overview

### **Initial Ideas from YC website:**

- Multiplayer AI

    By

    [Aaron Epstein](https://www.ycombinator.com/people/aaron-epstein)

    The best work tools of the last two decades won by going multiplayer. Google Docs replaced Microsoft Word. Figma beat Photoshop. And they turned solo tools into places where teams do their best work together.

    But AI hasn't had its multiplayer moment yet.

    AI agents are the most powerful new tool a team has, but it's the one thing people still use by themselves. That's because right now, working with AI is largely single-player. You open a chat, type a prompt, and get an answer, in a box only you can see. When you want to collaborate with your teammates and agents, the best you can do is send a link to a read-only transcript they can't touch.

    That's about to change.

    Agents are starting to run tasks that take hours, days, even weeks. Work at that scale was never meant to be done alone, and pulls in many people across a company. Anyone on a team should be able to drop into the same live agent session to watch it work, redirect it, and hand it off, the way they'd work with any other human team member. This turns the work a team does with agents into a shared, living thing instead of a thousand private threads.

    We think there's a version of this for every kind of work. Shared agents for engineers coding together in real time. For sales teams working a deal together. For support teams resolving a ticket. For lawyers drafting a contract, analysts building a model, and marketers shipping a campaign. Anywhere a team already crowds around one problem, there should be multiplayer agents they all share.

    So if you're building AI that's multiplayer by default, we'd love to hear from you.

- The Primer

    In Neal Stephenson's The Diamond Age, a young girl is given an interactive book called A Young Lady's Illustrated Primer. It looks like a tool for learning to read, but it's far more. It adapts to her completely, and through stories tuned to her life, it teaches her not just to read but to think, to reason, and eventually to grapple with the hardest questions of ethics, meaning, and character. She returns to it day after day for years, and as she grows, it grows too. Continually reshaping itself around who she is becoming and the life she is living.

    For the first time in history, something like the Primer is starting to feel possible.

    The best education has always come from one-on-one tutoring. Aristotle taught Alexander. But that privilege has been reserved for the few. AI can bring it to every child. And great tutors do more than drill facts. Over years, they learn a child's mind, and with it how to teach what can't be drilled at all: thinking, reasoning, even wisdom.

    In Stephenson's story, the Primer is an AI tutor that never runs out of patience or time. We're a long way from building one, but we can start today. What we'd love to see now is a product that adaptively teaches young children to read, write, and do arithmetic, at the quality of a devoted private tutor and at consumer scale. Not a replacement for teachers, but a supplement that makes them more effective.

    While we think this begins as something a parent buys to help their child learn basic skills, it is also the entry point to far greater ambitions. A company that gets it right could build toward something like the Primer, and even a fraction of that vision would have a profound effect on society.

    If you're building this, we'd love to hear from you.


### Our Resulting Hackathon idea:

- shared knowledge multiplayer AI - Think Github for group reasoning
- Users create a summary of the challenge or decision they are facing and can invite other users into the environment to help them work through it. Teams can utilize a chat box in the environment and  pull in useful resources to cooperatively solve problems.

<aside>

# Multiplayer AI for Team Collaboration

## Overview

- Designed at Codex hackathon in San Francisco
- Goal: Improve team collaboration on projects using multi-agent AI system
- Key objectives:
    - Distribute work evenly across team
    - Keep everyone aware of each other's progress
    - Enable parallel streams of development

## Current Pain Points

- Only the "driver" has full project context when interacting with AI
- Model gets confused by multiple people giving prompts simultaneously
- Hard for team members to meaningfully contribute ideas

## Proposed Architecture

- Master agent coordinates specialized sub-agents
- Each team member has their own sub-agent to work on distinct areas
- GitHub-like branching model:
    - Work happens in individual branches
    - Merged into master branch when ready to share
- Human approval required before master agent finalizes tasks
- New sub-agents created for new features to avoid corrupting existing context
- Sub-agents grouped by role: planning, execution, code review

## Key Features

- Real-time project status summary (auto-updates every 5-10 min)
- Search historical context for past decisions and reasoning
- Drag-and-drop prioritized task queue
- Visual project roadmap showing milestones and new idea impact
- Automatic scope impact analysis when new ideas are proposed
- Fun, game-like UX layer over the complex agent infrastructure

## Agent Interaction Model

- Sub-agents grouped by specialization: planning, execution, review
- Agents manage and trigger each other (e.g. review starts after execution)
- Shared context maintained across all agents and users

## Implementation

- `skills.md` file approach to align agents and provide context
- Traditional rigid tools considered outdated
- Strong emphasis on delightful, collaborative UX
- Goal: Automate tedious parts of teamwork while preserving creativity and fun
</aside>