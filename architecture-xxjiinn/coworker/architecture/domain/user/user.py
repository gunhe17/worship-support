from dataclasses import dataclass

from architecture.core.entity import Entity
from architecture.core.validate import typecheck

from architecture.domain.user.name import Name
from architecture.domain.user.birth import Birth
from architecture.domain.user.email import Email
from architecture.domain.user.password import Password


@dataclass(frozen=True, kw_only=True)
class User(Entity):
    name: Name
    birth: Birth
    email: Email
    password: Password

    # #
    # factory

    @classmethod
    @typecheck
    def new(
        cls, 
        *,
        name: Name,
        birth: Birth,
        email: Email,
        password: Password,
    ) -> "User":
        return cls(
            name=name,
            birth=birth,
            email=email,
            password=password,
            by_factory=True
        )

    # #
    # query

    def to_dict(self):
        return {
            "name": self.name.to_str(),
            "birth": self.birth.to_str(),
            "email": self.email.to_str(),
            "password": self.password.to_str(),
        }

    def to_model(self):
        return {
            
        }