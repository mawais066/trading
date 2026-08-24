import logging
from typing import List, Dict, Any
from openai import AsyncOpenAI, APIConnectionError, APIStatusError, AuthenticationError, NotFoundError, BadRequestError
from backend.config import settings

logger = logging.getLogger("ai_service")

class AIService:
    def __init__(self):
        self.model_name = settings.MODEL_NAME
        self.api_key = settings.AI_API_KEY
        self.base_url = settings.AI_API_BASE_URL.rstrip('/') if settings.AI_API_BASE_URL else "https://api.openai.com/v1"

    def get_client(self) -> AsyncOpenAI:
        return AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=30.0,
            max_retries=1
        )

    async def generate_response(self, messages: List[Dict[str, str]], temperature: float = 0.3) -> Dict[str, Any]:
        """
        Send a chat completion request to the OpenAI-compatible endpoint with the configured MODEL_NAME.
        If the model or provider errors, returns structured beginner-friendly diagnostic error without disguised fallbacks.
        """
        if not settings.is_ai_api_configured:
            return {
                "success": False,
                "error": "AI API key is not configured.",
                "details": (
                    "Please set your 'AI_API_KEY' in the '.env' file. "
                    "You can obtain an API key from an OpenAI-compatible provider (such as DeepSeek, OpenRouter, Together AI, or OpenAI)."
                ),
                "model_used": self.model_name,
                "content": None
            }

        client = self.get_client()

        try:
            response = await client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=temperature,
                max_tokens=2048,
            )
            
            content = response.choices[0].message.content
            return {
                "success": True,
                "model_used": self.model_name,
                "content": content,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens if response.usage else None,
                    "completion_tokens": response.usage.completion_tokens if response.usage else None,
                    "total_tokens": response.usage.total_tokens if response.usage else None
                }
            }

        except AuthenticationError as e:
            logger.warning(f"AI Authentication error: {e}")
            return {
                "success": False,
                "error": "AI API Authentication Failed",
                "details": (
                    f"The provided AI_API_KEY was rejected by provider ({self.base_url}). "
                    "Please verify your AI_API_KEY in the .env file."
                ),
                "model_used": self.model_name,
                "content": None
            }

        except NotFoundError as e:
            logger.warning(f"AI Model Not Found error: {e}")
            return {
                "success": False,
                "error": f"Model '{self.model_name}' Not Found",
                "details": (
                    f"The selected provider ({self.base_url}) reported that model '{self.model_name}' does not exist or is not enabled for your account. "
                    f"To resolve, update MODEL_NAME in your .env file to a model supported by your provider."
                ),
                "model_used": self.model_name,
                "content": None
            }

        except BadRequestError as e:
            logger.warning(f"AI Bad Request error: {e}")
            # Specifically handle OCR model / modality limitations
            err_msg = str(e)
            is_ocr_issue = "ocr" in self.model_name.lower() or "modality" in err_msg.lower() or "chat" in err_msg.lower()
            return {
                "success": False,
                "error": f"Model '{self.model_name}' Inference Error",
                "details": (
                    f"Provider returned a 400 Bad Request: {err_msg}. "
                    + (
                        f"\n\nNote: The configured model '{self.model_name}' is an OCR/Vision model. "
                        "If your provider does not support text/chat completions on this endpoint, "
                        "you can change MODEL_NAME in your .env file to a chat-compatible model."
                        if is_ocr_issue else ""
                    )
                ),
                "model_used": self.model_name,
                "content": None
            }

        except APIStatusError as e:
            logger.error(f"AI API Status Error: {e}")
            return {
                "success": False,
                "error": f"AI Provider HTTP Error ({e.status_code})",
                "details": f"The AI provider returned an error: {e.message or str(e)}",
                "model_used": self.model_name,
                "content": None
            }

        except APIConnectionError as e:
            logger.error(f"AI Connection Error: {e}")
            return {
                "success": False,
                "error": "AI Provider Connection Failed",
                "details": f"Could not connect to AI endpoint ({self.base_url}). Check network connectivity or base URL.",
                "model_used": self.model_name,
                "content": None
            }

        except Exception as e:
            logger.exception("Unexpected AI service failure")
            return {
                "success": False,
                "error": "Unexpected AI Service Error",
                "details": str(e),
                "model_used": self.model_name,
                "content": None
            }

ai_service = AIService()
