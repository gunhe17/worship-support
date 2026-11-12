from __future__ import annotations

from dataclasses import dataclass, field


# #
# memory

@dataclass
class Memory:
    actions: set = field(default_factory=set)


# #
# scope

class Scope:
    ...


# #
# action

class Action:
    @classmethod
    async def act(cls, memory: Memory) -> None:
        ...


# #
# behavior

class Behavior:
    def set_action(self, memory: Memory, *requires: Action) -> None:
        memory.actions = {type(action) for action in requires}

    async def run_action(self, memory: Memory, *, action: type[Action]) -> None:
        if action in memory.actions:
            await action.act(memory)
