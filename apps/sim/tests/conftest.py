import pathlib
import sys

import pytest

# Make the package importable when pytest is invoked from apps/sim.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from sim.profile import load_catalogue, load_ontology, load_profile


@pytest.fixture(scope="session")
def ontology():
    return load_ontology()


@pytest.fixture(scope="session")
def profile():
    return load_profile()


@pytest.fixture(scope="session")
def catalogue():
    return load_catalogue()
