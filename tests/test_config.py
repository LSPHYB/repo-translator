"""Tests for repo_translator.config — focused on RepoConfig's url/path mutual exclusion."""

import pytest
from pydantic import ValidationError

from repo_translator.config import RepoConfig


def test_repo_config_url_only_is_valid() -> None:
    repo = RepoConfig(name="langchain", url="https://github.com/langchain-ai/langchain")
    assert repo.url == "https://github.com/langchain-ai/langchain"
    assert repo.path is None
    assert repo.is_managed is True
    assert repo.is_external is False


def test_repo_config_path_only_is_valid() -> None:
    repo = RepoConfig(name="my-project", path="~/code/my-project")
    assert repo.path == "~/code/my-project"
    assert repo.url is None
    assert repo.is_managed is False
    assert repo.is_external is True


def test_repo_config_both_url_and_path_is_invalid() -> None:
    with pytest.raises(ValidationError):
        RepoConfig(
            name="langchain",
            url="https://github.com/langchain-ai/langchain",
            path="~/code/langchain",
        )


def test_repo_config_neither_url_nor_path_is_invalid() -> None:
    with pytest.raises(ValidationError):
        RepoConfig(name="langchain")
