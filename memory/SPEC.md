# Milton I.A — Living Spec

Gamified learning platform for Ensino Fundamental Anos Finais (6º–9º) and Ensino Médio (1ª–3ª), aligned to Currículo Paulista (SEDUC-SP), Currículo Priorizado and BNCC. UI in pt-BR. Stack: FastAPI + MongoDB (motor) / Vite React 19 + Tailwind v4 + shadcn (base-ui). AI: OpenAI GPT-5.2 via emergentintegrations + EMERGENT_LLM_KEY.

## Roles & auth
- student / teacher / manager / guardian (responsável: `children_ids`, sees only linked students at /familia). Email+password (pbkdf2), JWT httpOnly cookie `milton_session`. No signup — gestor creates users. Credentials: memory/test_credentials.md.

## Key flows
- Trilhas: `/api/curriculum/{grade}` → subjects → 4 topics (one per bimestre: unidade, habilidade BNCC, objeto) from `backend/lib/curriculum.py`.
- Quiz: POST `/api/quizzes/start {topic_id, mode rapido|completo|master (5/10/20)}` or `{custom_quiz_id}`. Questions come from `questions` bank per topic; when insufficient, GPT-5.2 generates them in parallel batches of 5 (≈15–30s) and they are cached. Types: multiple_choice, true_false, complete (lacuna `_____`), association (drag & drop / tap). GET `/api/quizzes/attempts/{id}`, POST `.../submit {answers, duration_sec}` → server grades: acertos, erros, correções comentadas, sugestões, XP, new medals.
- XP: correct×10 + mode bonus (10/25/60), ENEM +5/question, content view +5 once (`/api/content/viewed`), redação +30, first activity of day +5 (participação diária) and updates streak. Level = xp//300+1.
- Medals: Aprendiz, Explorador, Cientista, Mestre do Conhecimento, Especialista em Matemática, Leitor Nota 10, Jovem Pesquisador; achievements: 7/15/30-day streak, Rumo ao ENEM, Redator (computed in lib/gamification.py).
- Ranking `/api/rankings?period=daily|weekly|monthly|all&scope=class|school` (aggregates xp_events).
- Missão ENEM: `/api/enem/start {area, count 5|10|20}` (AI ENEM-style questions, 3 min/question countdown, auto-submit), `/api/enem/stats` (radar + plano), `/api/enem/redacao` (AI correction by 5 competências).
- Central de Estudos: `/api/materials` (search q/type) CRUD for staff; uploads via `/api/uploads` (local disk backend/uploads, served at `/api/files/{name}`).
- Mural: `/api/mural` posts (image/video ≤3min checked client side), scheduling via publish_at (students only see published), likes, audiodescrição (alt_text, TTS).
- Tutor: POST `/api/tutor/chat` SSE (events session/delta/error/done), modes explicar/duvida/questoes/resumir/mapa_mental/plano; history in tutor_messages/tutor_sessions.
- Professor: `/api/teacher/generate` (AI preview), `/api/teacher/quizzes` (publish custom quiz/desafio), `/api/reports/overview` + `/api/reports/student/{id}`.
- Gestor: `/api/admin/dashboard`, `/api/admin/users`, `/api/admin/classes`, `/api/classes`, PUT `/api/admin/school` (name, logo, city, diretoria). Public GET `/api/school`.
- Accessibility (client, localStorage): dark mode, high contrast, font 100/115/130%, simplified navigation (no animations/decor), sounds, read page/question aloud (Web Speech pt-BR). Libras = future integration.

- School identity: E.E. Prof. Milton Leme do Prado · Programa Ensino Integral; logo at frontend/public/logo-milton.png (settings.logo_url "/logo-milton.png"); brand tokens --school (blue #2148C9), --school-red, --school-yellow, `.school-stripe` used on login/home/family.
- Image questions: questions have `image_url`. AI quiz batches ask GPT-5.2 for exactly 1 image question per batch (`image_prompt`), rendered by Nano Banana (gemini-3.1-flash-image-preview) via lib/ai.generate_image → saved in backend/uploads (lib/storage.py). If the image fails, the question is dropped. Teachers can upload or AI-generate per question (POST /api/teacher/question-image {prompt}). ENEM questions have no images.
- Duelos (async, 24h): POST /api/duels {opponent_id (same grade), topic_id} → challenger attempt (kind "duel"); opponent POST /api/duels/{id}/accept | /decline; both answer the same 5 questions; on second submit winner = more correct, tiebreak lower time, +50 XP bonus (lib/duels.py). Lazy expiry on list/accept: the only finisher wins by W.O. GET /api/duels, /api/duels/opponents.
- Família: GET /api/family/summary (guardian only) → per child weekly XP vs previous week, streak, active days, avg score, minutes, daily XP, subjects <60% (30d) and strengths ≥70%. Gestor creates guardians with linked students in Usuários.

## Collections
users, classes, questions, attempts, xp_events, access_log, custom_quizzes, materials, mural, content_views, essays, duels, tutor_messages, tutor_sessions, settings.

## Known limits
- "Questões de provas anteriores" are AI-generated in ENEM style (plus links to INEP official tests in Central de Estudos), not verbatim past items. 
