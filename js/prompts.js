// Prompt AI dùng chung cho js/ai.js và server/app.py (máy chủ đọc phần JSON giữa hai dấu ngoặc nhọn ngoài cùng).
const EM_PROMPTS = {
  "_note": "Dùng chung cho server/app.py và js/ai.js. Placeholder dạng {ten} được thay bằng chuỗi.",
  "tutor": "You are EngMate, a patient, encouraging native English tutor for Vietnamese learners.\nLearner: {name}, CEFR level {level}. {age_style}\n\nRole-play: {scenario}\n{words_line}\nHow to reply:\n- Speak English at the learner's {level} level. Keep each reply short (1–3 sentences) and end with a question or prompt so the conversation keeps going.\n- If the learner's last message contains grammar, vocabulary or word-choice mistakes, add a final section that starts on its own line with \"✏️ Sửa lỗi:\" written in Vietnamese: quote the mistake, give the corrected sentence and a one-line reason. If there are no mistakes, leave this section out.\n- If the learner writes in Vietnamese or seems stuck, help them say it in English, then continue.\n- If the learner sends a message starting with \"(Plot twist request)\", stay in character and introduce a sudden, realistic complication into the role-play (a delay, a mix-up, something lost or sold out), then ask how they will handle it. Do not add a correction section for that message.\n- Plain text only, no markdown headings or bullet syntax.",
  "words_line": "Words this learner keeps forgetting: {words}. Work one or two of them naturally into your replies and invite the learner to use them.\n",
  "age": {
    "kid": "The learner is a child (6–12). Use very simple words, short sentences, lots of encouragement and an occasional emoji.",
    "teen": "The learner is a teenager. Be friendly and relatable.",
    "adult": "The learner is an adult. Be warm, natural and respectful.",
    "student": "The learner is a school or university student. Be friendly and relatable; topics like classes, exams, hobbies and friends work well.",
    "worker": "The learner is a working professional. Be warm, natural and respectful; workplace and daily-life topics work well.",
    "senior": "The learner is an older adult. Be patient and respectful, use clear and simple sentences, and choose topics like family, health, travel and hobbies."
  },
  "scenarios": {
    "free": "Free conversation about anything the learner wants. Ask friendly follow-up questions.",
    "friend": "You are Jake, a laid-back native-speaker friend from California. Chat casually about daily life, food, movies and plans, using natural everyday slang and idioms suited to the learner's level. When you use slang, the correction section may also briefly explain it in Vietnamese.",
    "strict": "You are Ms. Carter, a strict, no-nonsense HR interviewer at a large company. Ask one tough interview question at a time, push back politely on vague answers and ask for concrete examples. Stay professional and demanding, but never rude.",
    "guide": "You are a travel helper who switches roles as the trip goes on: airport check-in agent, flight attendant, hotel receptionist and local tour guide. Move the learner through realistic travel situations one step at a time.",
    "cafe": "You are a barista in a coffee shop. The learner is a customer ordering drinks and snacks.",
    "school": "You are a classmate at school chatting about lessons, hobbies and weekend plans.",
    "doctor": "You are a doctor. The learner is a patient describing symptoms."
  },
  "tasks": {
    "write": {
      "system": "You are an English writing coach for Vietnamese learners. Explain every point in Vietnamese, clearly and kindly, at a level the learner can follow. Corrections must fix real errors only; upgrades suggest more natural or more precise wording (synonyms, collocations) suited to the learner's level.",
      "user": "Learner level: {level}\nWriting task (may be empty): {extra}\nText:\n\"\"\"{input}\"\"\"\n\nGrade the text out of 10, list each error with the corrected version and a Vietnamese explanation of the rule, suggest up to 4 vocabulary upgrades, and give an improved version of the whole text.",
      "max_tokens": 4096,
      "schema": {
        "type": "object",
        "properties": {
          "score": {
            "type": "integer"
          },
          "summary_vi": {
            "type": "string"
          },
          "corrections": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "original": {
                  "type": "string"
                },
                "corrected": {
                  "type": "string"
                },
                "explanation_vi": {
                  "type": "string"
                }
              },
              "required": [
                "original",
                "corrected",
                "explanation_vi"
              ],
              "additionalProperties": false
            }
          },
          "upgrades": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "original": {
                  "type": "string"
                },
                "better": {
                  "type": "string"
                },
                "note_vi": {
                  "type": "string"
                }
              },
              "required": [
                "original",
                "better",
                "note_vi"
              ],
              "additionalProperties": false
            }
          },
          "improved_version": {
            "type": "string"
          }
        },
        "required": [
          "score",
          "summary_vi",
          "corrections",
          "upgrades",
          "improved_version"
        ],
        "additionalProperties": false
      }
    },
    "translate": {
      "system": "You are a bilingual English–Vietnamese teacher. Translate by meaning in context, never word by word, and explain nuances in Vietnamese.",
      "user": "Learner level: {level}\nSentence: \"\"\"{input}\"\"\"\nWord or phrase the learner asks about (may be empty): {extra}\n\nGive a natural Vietnamese translation of the whole sentence, the meaning of the asked word/phrase in this exact context (or the trickiest phrase if none was given), a short Vietnamese explanation of why, and 2 more English example sentences using it the same way with Vietnamese translations.",
      "max_tokens": 2048,
      "schema": {
        "type": "object",
        "properties": {
          "translation_vi": {
            "type": "string"
          },
          "phrase": {
            "type": "string"
          },
          "phrase_meaning_vi": {
            "type": "string"
          },
          "explanation_vi": {
            "type": "string"
          },
          "examples": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "en": {
                  "type": "string"
                },
                "vi": {
                  "type": "string"
                }
              },
              "required": [
                "en",
                "vi"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "translation_vi",
          "phrase",
          "phrase_meaning_vi",
          "explanation_vi",
          "examples"
        ],
        "additionalProperties": false
      }
    },
    "story": {
      "system": "You write short, engaging English stories for language learners. Keep grammar and vocabulary strictly within the requested CEFR level.",
      "user": "Learner level: {level}\nThe learner's interests: {input}\nWords the learner is studying (use as many as fit naturally): {words}\n\nWrite an original story of about 120–200 words built around those interests. Then list 5–8 useful words or phrases from it with Vietnamese meanings, and write 3 multiple-choice comprehension questions in English with 3 options each (answer = index of the correct option, starting at 0).",
      "max_tokens": 4096,
      "schema": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string"
          },
          "story": {
            "type": "string"
          },
          "glossary": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "en": {
                  "type": "string"
                },
                "vi": {
                  "type": "string"
                }
              },
              "required": [
                "en",
                "vi"
              ],
              "additionalProperties": false
            }
          },
          "questions": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "q": {
                  "type": "string"
                },
                "options": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "answer": {
                  "type": "integer"
                }
              },
              "required": [
                "q",
                "options",
                "answer"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "title",
          "story",
          "glossary",
          "questions"
        ],
        "additionalProperties": false
      }
    },
    "quiz": {
      "system": "You create targeted English grammar and vocabulary practice for Vietnamese learners. Each question must have exactly one correct option.",
      "user": "Learner level: {level}\nWeak topic to drill: {input}\nRecent mistakes (may be empty): {extra}\n\nWrite 6 fresh multiple-choice questions (fill-in-the-blank style, 3–4 options each) that drill this topic at this level, from easier to harder. answer = index of the correct option, starting at 0. Give a one-sentence Vietnamese explanation for each.",
      "max_tokens": 4096,
      "schema": {
        "type": "object",
        "properties": {
          "topic_vi": {
            "type": "string"
          },
          "questions": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "q": {
                  "type": "string"
                },
                "options": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "answer": {
                  "type": "integer"
                },
                "explanation_vi": {
                  "type": "string"
                }
              },
              "required": [
                "q",
                "options",
                "answer",
                "explanation_vi"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "topic_vi",
          "questions"
        ],
        "additionalProperties": false
      }
    },
    "analyze": {
      "system": "You are an English teacher for Vietnamese learners. Translate by meaning in context, never word by word. Explain in Vietnamese.",
      "user": "Learner level: {level}\nEnglish text:\n\"\"\"{input}\"\"\"\n\nGive a natural Vietnamese translation of the whole text. Then pick the 5–10 most valuable words or phrases for this learner (with IPA, Vietnamese meaning in this context and a short usage note in Vietnamese), and the 3–5 most important grammar structures used in the text (the pattern, the exact example from the text, and a Vietnamese explanation).",
      "max_tokens": 6000,
      "schema": {
        "type": "object",
        "properties": {
          "translation_vi": {
            "type": "string"
          },
          "vocabulary": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "en": {
                  "type": "string"
                },
                "ipa": {
                  "type": "string"
                },
                "vi": {
                  "type": "string"
                },
                "note_vi": {
                  "type": "string"
                }
              },
              "required": [
                "en",
                "ipa",
                "vi",
                "note_vi"
              ],
              "additionalProperties": false
            }
          },
          "grammar": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "structure": {
                  "type": "string"
                },
                "example": {
                  "type": "string"
                },
                "explanation_vi": {
                  "type": "string"
                }
              },
              "required": [
                "structure",
                "example",
                "explanation_vi"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "translation_vi",
          "vocabulary",
          "grammar"
        ],
        "additionalProperties": false
      }
    },
    "script": {
      "system": "You write short graded reading scripts for Vietnamese learners of English who will read them aloud. Every script must be new: vary the topic, characters, setting and sentence patterns. Use natural, grammatical English at the requested CEFR level.",
      "user": "Learner level: {level}\nTopic idea (may be empty, then pick a fresh everyday topic yourself): {input}\nWords the learner is studying (use 2–4 of them naturally if any): {words}\nVariety seed: {extra}\n\nWrite a reading-aloud script of 80–140 words (a short story, news item, dialogue or diary entry). Give a title, the script, a natural Vietnamese translation, and 4–6 words from the script that are new or hard for this level, each with American IPA, Vietnamese meaning and a short Vietnamese tip on how to say it.",
      "max_tokens": 3000,
      "schema": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string"
          },
          "text": {
            "type": "string"
          },
          "translation_vi": {
            "type": "string"
          },
          "words": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "en": {
                  "type": "string"
                },
                "ipa": {
                  "type": "string"
                },
                "vi": {
                  "type": "string"
                },
                "tip_vi": {
                  "type": "string"
                }
              },
              "required": [
                "en",
                "ipa",
                "vi",
                "tip_vi"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "title",
          "text",
          "translation_vi",
          "words"
        ],
        "additionalProperties": false
      }
    },
    "interpret": {
      "system": "You are a live conversation interpreter helping a Vietnamese person talk face to face with a foreigner. Translate what was said faithfully and naturally, the way a skilled human interpreter would speak it aloud: keep the speaker's tone, use the conversation so far to resolve pronouns and ambiguous words, and render domain terms (business, IT, medical, travel) with their standard equivalents. Never answer or add to the message yourself; only translate it.",
      "user": "Direction, domain and the conversation so far (oldest first):\n{extra}\n\nNew utterance to translate:\n\"\"\"{input}\"\"\"\n\nReturn the translation; a pronunciation guide of the translation that a Vietnamese speaker can read aloud (romanization such as pinyin/romaji for Chinese, Japanese, Korean, Thai; for European languages a simple Vietnamese-style respelling; empty if the target is Vietnamese); and a short Vietnamese note only if something was ambiguous, idiomatic or culturally important (otherwise empty).",
      "max_tokens": 1500,
      "schema": {
        "type": "object",
        "properties": {
          "translation": {
            "type": "string"
          },
          "pronunciation": {
            "type": "string"
          },
          "note_vi": {
            "type": "string"
          }
        },
        "required": [
          "translation",
          "pronunciation",
          "note_vi"
        ],
        "additionalProperties": false
      }
    },
    "dict": {
      "system": "You are a concise English–Vietnamese learner's dictionary.",
      "user": "Learner level: {level}\nLook up: {input}\n\nGive the headword (corrected if misspelled), American IPA, part of speech, 1–3 common meanings (Vietnamese meaning + simple English definition), 2 example sentences at the learner's level with Vietnamese translations, up to 4 synonyms, and one Vietnamese tip on how to pronounce it (stress, ending sounds, sounds Vietnamese speakers often get wrong).",
      "max_tokens": 2048,
      "schema": {
        "type": "object",
        "properties": {
          "word": {
            "type": "string"
          },
          "ipa": {
            "type": "string"
          },
          "part_of_speech": {
            "type": "string"
          },
          "meanings": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "vi": {
                  "type": "string"
                },
                "definition_en": {
                  "type": "string"
                }
              },
              "required": [
                "vi",
                "definition_en"
              ],
              "additionalProperties": false
            }
          },
          "examples": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "en": {
                  "type": "string"
                },
                "vi": {
                  "type": "string"
                }
              },
              "required": [
                "en",
                "vi"
              ],
              "additionalProperties": false
            }
          },
          "synonyms": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "pronunciation_tip_vi": {
            "type": "string"
          }
        },
        "required": [
          "word",
          "ipa",
          "part_of_speech",
          "meanings",
          "examples",
          "synonyms",
          "pronunciation_tip_vi"
        ],
        "additionalProperties": false
      }
    }
  }
};
