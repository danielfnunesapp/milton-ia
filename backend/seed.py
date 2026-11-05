"""Seed idempotente do Milton I.A — escola, turmas, usuários demo, histórico, materiais e mural.

Executar: cd /app/backend && python seed.py
"""

import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone

from lib.auth import hash_password
from lib.curriculum import subjects_for, topics_for
from lib.db import db, ensure_indexes
from lib.gamification import days_ago

COLORS = ["#6366F1", "#10B981", "#F59E0B", "#0EA5E9", "#EC4899", "#8B5CF6", "#EF4444", "#14B8A6"]
CLASSES = [("c-6a", "6º A", "6EF"), ("c-7a", "7º A", "7EF"), ("c-8a", "8º A", "8EF"), ("c-9a", "9º A", "9EF"),
           ("c-1em", "1ª Série A", "1EM"), ("c-2em", "2ª Série A", "2EM"), ("c-3em", "3ª Série A", "3EM")]
STUDENT_NAMES = ["Ana Beatriz Souza", "Pedro Henrique Lima", "Maria Eduarda Santos", "João Victor Oliveira", "Larissa Costa",
                 "Gabriel Almeida", "Isabela Ferreira", "Lucas Rodrigues", "Yasmin Carvalho", "Rafael Gomes", "Beatriz Martins",
                 "Matheus Ribeiro", "Júlia Barbosa", "Enzo Pereira", "Sofia Araújo", "Davi Nascimento", "Manuela Rocha",
                 "Arthur Mendes", "Valentina Dias", "Heitor Cardoso"]

USERS = [
    {"id": "u-gestor", "name": "Cláudia Ramos", "email": "gestor@milton.edu.br", "password": "milton123", "role": "manager"},
    {"id": "u-prof", "name": "Prof. Ricardo Moura", "email": "professor@milton.edu.br", "password": "milton123", "role": "teacher"},
    {"id": "u-aluno", "name": "Lucas Silva", "email": "aluno@milton.edu.br", "password": "milton123", "role": "student", "grade": "9EF", "class_id": "c-9a"},
    {"id": "u-resp", "name": "Marta Silva", "email": "responsavel@milton.edu.br", "password": "milton123", "role": "guardian", "children_ids": ["u-aluno"]},
    {"id": "u-aluna-em", "name": "Camila Torres", "email": "aluna.em@milton.edu.br", "password": "milton123", "role": "student", "grade": "3EM", "class_id": "c-3em"},
]

MATERIALS = [
    ("Currículo Paulista — Ensino Fundamental", "Documento oficial com as habilidades por série e componente.", "seduc", "https://efape.educacao.sp.gov.br/curriculopaulista/", None, None),
    ("Currículo Paulista — Etapa Ensino Médio", "Organização por áreas, itinerários formativos e habilidades EM13.", "seduc", "https://efape.educacao.sp.gov.br/curriculopaulista/ensino-medio/", None, None),
    ("Materiais Digitais SEDUC-SP", "Aulas e slides digitais disponibilizados pela Secretaria da Educação.", "seduc", "https://saladofuturo.educacao.sp.gov.br/", None, None),
    ("BNCC — Base Nacional Comum Curricular", "Texto integral da BNCC no portal do MEC.", "link", "http://basenacionalcomum.mec.gov.br/", None, None),
    ("Khan Academy — Matemática 9º ano", "Videoaulas e exercícios de funções, equações e geometria.", "link", "https://pt.khanacademy.org/math", "9EF", "Matemática"),
    ("Apostila: Equações do 2º grau", "Resumo teórico com fórmula de Bhaskara e exercícios resolvidos.", "apostila", "https://pt.khanacademy.org/math/algebra/x2f8bb11595b61c86:quadratic-functions-equations", "9EF", "Matemática"),
    ("Slides: Modelos atômicos", "De Dalton a Bohr — linha do tempo ilustrada.", "slides", "https://pt.khanacademy.org/science/chemistry", "9EF", "Ciências"),
    ("Provas e gabaritos anteriores do ENEM (INEP)", "Acesse as provas oficiais das edições anteriores.", "pdf", "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos", None, None),
    ("Cartilha da Redação do ENEM", "Guia oficial do participante com as 5 competências.", "pdf", "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/outros-documentos", "3EM", "Língua Portuguesa"),
]

MURAL = [
    ("Como funciona a fotossíntese?", "Infográfico: luz + água + CO₂ → glicose + O₂.", "Ciências", "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=1200", "Folhas verdes iluminadas pelo sol, representando a fotossíntese."),
    ("Teorema de Pitágoras na prática", "a² + b² = c² — descubra onde ele aparece no dia a dia!", "Matemática", "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200", "Quadro com fórmulas matemáticas e figuras geométricas."),
    ("Linha do tempo: Era Vargas", "De 1930 a 1945 em 6 marcos.", "História", "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=1200", "Livros antigos empilhados representando documentos históricos."),
    ("Biomas brasileiros", "Amazônia, Cerrado, Caatinga, Mata Atlântica, Pampa e Pantanal.", "Geografia", "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200", "Floresta tropical densa vista de cima."),
    ("Contagem regressiva ENEM", "Organize seus estudos com a Missão ENEM do Milton I.A!", "ENEM", "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200", "Estudante escrevendo em caderno com livros ao redor."),
]


async def main() -> None:
    now = datetime.now(timezone.utc)
    await db.settings.update_one({"key": "school"}, {"$setOnInsert": {"key": "school", "name": "E.E. Prof. Milton Leme do Prado",
                                 "logo_url": "/logo-milton.png", "city": "São Paulo - SP", "diretoria": "Programa Ensino Integral"}}, upsert=True)
    for cid, name, grade in CLASSES:
        await db.classes.update_one({"id": cid}, {"$set": {"id": cid, "name": name, "grade": grade}}, upsert=True)

    for u in USERS:
        doc = {k: v for k, v in u.items() if k != "password"}
        await db.users.update_one({"id": u["id"]}, {"$set": {**doc, "password_hash": hash_password(u["password"])},
                                  "$setOnInsert": {"xp": 0, "streak": 0, "best_streak": 0, "avatar_color": "#6366F1", "created_at": now}}, upsert=True)

    already = await db.attempts.count_documents({"seed": True})
    rnd = random.Random(42)
    students = []
    for i, name in enumerate(STUDENT_NAMES):
        cid, _, grade = CLASSES[i % len(CLASSES)] if i >= 6 else CLASSES[3]  # 6 extra colegas no 9º A
        sid = f"u-s{i:02d}"
        students.append((sid, grade, cid))
        await db.users.update_one({"id": sid}, {"$set": {"id": sid, "name": name, "email": f"aluno{i + 1:02d}@milton.edu.br",
                                  "role": "student", "grade": grade, "class_id": cid, "avatar_color": COLORS[i % len(COLORS)]},
                                  "$setOnInsert": {"password_hash": hash_password("milton123"), "xp": 0, "streak": 0, "best_streak": 0, "created_at": now}}, upsert=True)
    students.append(("u-aluno", "9EF", "c-9a"))
    students.append(("u-aluna-em", "3EM", "c-3em"))

    if not already:  # histórico sintético: tentativas + XP nos últimos 30 dias
        for sid, grade, cid in students:
            total_xp, days = 0, sorted(rnd.sample(range(30), rnd.randint(6, 22)))
            for d in days:
                subj = rnd.choice(subjects_for(grade))
                topic = rnd.choice(topics_for(grade, subj))
                total = rnd.choice([5, 5, 10])
                correct = rnd.randint(max(1, total // 3), total)
                score = round(100 * correct / total)
                xp = correct * 10 + (10 if total == 5 else 25) + 5
                total_xp += xp
                date = days_ago(d)
                ts = now - timedelta(days=d, hours=rnd.randint(0, 8))
                await db.attempts.insert_one({"id": str(uuid.uuid4()), "user_id": sid, "kind": "quiz", "seed": True,
                    "title": f"{'Quiz Rápido' if total == 5 else 'Quiz Completo'} · {subj}", "subtitle": topic["objeto"],
                    "subject": subj, "mode": "rapido" if total == 5 else "completo", "topic_id": topic["id"], "status": "done",
                    "question_ids": [], "correct": correct, "total": total, "score": score, "xp": xp,
                    "duration_sec": total * rnd.randint(30, 70), "grade": grade, "class_id": cid, "date": date,
                    "created_at": ts, "finished_at": ts})
                await db.xp_events.insert_one({"user_id": sid, "amount": xp, "reason": "Quiz", "date": date, "created_at": ts, "seed": True})
                await db.access_log.update_one({"user_id": sid, "date": date}, {"$setOnInsert": {"user_id": sid, "date": date}}, upsert=True)
            streak = 0
            for d in range(0 if 0 in days else 1, 30):  # sequência terminando hoje ou ontem
                if d in days:
                    streak += 1
                else:
                    break
            await db.users.update_one({"id": sid}, {"$set": {"xp": total_xp, "streak": streak, "best_streak": max(streak, 3),
                                      "last_active_date": days_ago(days[0])}})

    if not await db.materials.count_documents({}):
        for t, desc, typ, url, grade, subj in MATERIALS:
            await db.materials.insert_one({"id": str(uuid.uuid4()), "title": t, "description": desc, "type": typ, "url": url,
                                           "grade": grade, "subject": subj, "created_by_name": "Prof. Ricardo Moura", "created_at": now})
    if not await db.mural.count_documents({}):
        for i, (t, desc, cat, url, alt) in enumerate(MURAL):
            await db.mural.insert_one({"id": str(uuid.uuid4()), "title": t, "description": desc, "category": cat, "media_type": "image",
                                       "media_url": url, "alt_text": alt, "publish_at": now - timedelta(hours=i * 20), "liked_by": [],
                                       "created_by_name": "Prof. Ricardo Moura", "created_at": now})
    await ensure_indexes()
    print("seed ok")


if __name__ == "__main__":
    asyncio.run(main())
