"""
Tests for medical context injection in LLMAgent._build_messages
and build_medical_context_block helper.
No real LLM calls — client is mocked.
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from unittest.mock import MagicMock
from llm.prompts import build_medical_context_block


class TestBuildMedicalContextBlock:
    def test_all_fields_present(self):
        block = build_medical_context_block(
            allergies="Penicillin",
            conditions="Type II Diabetes",
            blood_type="A+",
        )
        assert "Penicillin" in block
        assert "Type II Diabetes" in block
        assert "A+" in block

    def test_empty_returns_empty_string(self):
        block = build_medical_context_block(None, None, None)
        assert block == ""

    def test_partial_fields(self):
        block = build_medical_context_block(allergies="Peanuts", conditions=None, blood_type=None)
        assert "Peanuts" in block
        assert "conditions" not in block.lower() or "None" not in block


class TestLLMAgentMedicalContextInjection:
    def _make_agent(self):
        from services.llm_agent import LLMAgent
        return LLMAgent(client=MagicMock())

    def test_medical_context_injected_when_opted_in(self):
        agent = self._make_agent()
        profile = {
            "medical_chat_opt_in": True,
            "allergies": "Penicillin",
            "conditions": "Hypertension",
            "blood_type": "O+",
        }
        msgs = agent._build_messages("I feel sick", [], user_profile=profile)
        system_content = msgs[0].content
        assert "Penicillin" in system_content
        assert "Hypertension" in system_content
        assert "O+" in system_content

    def test_no_injection_when_not_opted_in(self):
        agent = self._make_agent()
        profile = {
            "medical_chat_opt_in": False,
            "allergies": "Penicillin",
            "conditions": "Hypertension",
            "blood_type": "O+",
        }
        msgs = agent._build_messages("I feel sick", [], user_profile=profile)
        system_content = msgs[0].content
        assert "Penicillin" not in system_content

    def test_no_injection_when_profile_none(self):
        agent = self._make_agent()
        msgs = agent._build_messages("I feel sick", [], user_profile=None)
        system_content = msgs[0].content
        assert "Patient Medical Context" not in system_content
