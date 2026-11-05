"""Milton I.A — LLM helpers (OpenAI GPT-5.2 via Emergent LLM key)."""

import asyncio
import base64
import json
import logging
import os
import re
import uuid

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage

from lib.storage import save_bytes

logger = logging.getLogger(__name__)
PROVIDER, MODEL = "openai", "gpt-5.2"
IMAGE_MODEL = "gemini-3.1-flash-image-preview"


def new_chat(system: str, history: list[dict] | None = None) -> LlmChat:
    msgs = [{"role": "system", "content": system}] + (history or [])
    return LlmChat(
        api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
        session_id=str(uuid.uuid4()),
        system_message=system,
        initial_messages=msgs,
    ).with_model(PROVIDER, MODEL)


async def complete(system: str, prompt: str) -> str:
    chat = new_chat(system)
    parts: list[str] = []
    async for ev in chat.stream_message(UserMessage(text=prompt)):
        if isinstance(ev, TextDelta):
            parts.append(ev.content)
        elif isinstance(ev, StreamDone):
            break
    return "".join(parts)


def parse_json(text: str) -> dict:
    text = re.sub(r"```(?:json)?", "", text)
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("no json")
    return json.loads(m.group(0))


QUESTION_SYSTEM = (
    "Você é um professor especialista no Currículo Paulista (SEDUC-SP), no Currículo Priorizado da SEDUC-SP "
    "e na BNCC. Cria questões pedagógicas corretas, claras, em português do Brasil, adequadas à série do estudante. "
    "Responda SOMENTE com JSON válido, sem texto adicional."
)

QUESTION_FORMAT = (
    'Formato JSON: {"questions": [{"type": "multiple_choice|true_false|complete|association", '
    '"statement": "enunciado", "options": ["..."], "answer": "texto exato da opção correta", '
    '"pairs": [{"left": "conceito", "right": "definição"}], "explanation": "correção comentada (2-3 frases)", '
    '"image_prompt": ""}]}. '
    "Regras: multiple_choice tem 4 opções; true_false tem options [\"Verdadeiro\", \"Falso\"]; complete tem uma lacuna "
    "'_____' no enunciado e 4 opções; association tem 3 ou 4 pares em 'pairs', options vazio e answer vazio. "
    "'answer' deve ser idêntico a uma das opções."
)
IMAGE_RULE = (
    " Em cada lote, inclua EXATAMENTE 1 questão multiple_choice com imagem (mapa, gráfico, diagrama, tabela ou esquema "
    "científico): preencha 'image_prompt' com uma descrição visual detalhada e objetiva do que desenhar (elementos, valores, "
    "rótulos curtos em português) e escreva o enunciado referindo-se a 'a imagem'. Nas demais questões, image_prompt = \"\"."
)


def _valid(q: dict) -> dict | None:
    t = q.get("type")
    st = (q.get("statement") or "").strip()
    if not st or t not in {"multiple_choice", "true_false", "complete", "association"}:
        return None
    out = {"type": t, "statement": st, "explanation": (q.get("explanation") or "").strip(),
           "options": [], "answer": "", "pairs": [], "image_url": None,
           "image_prompt": str(q.get("image_prompt") or "").strip()}
    if t == "association":
        pairs = [p for p in q.get("pairs") or [] if p.get("left") and p.get("right")]
        if len(pairs) < 2:
            return None
        out["pairs"] = [{"left": str(p["left"]), "right": str(p["right"])} for p in pairs]
        return out
    opts = [str(o) for o in q.get("options") or [] if str(o).strip()]
    if t == "true_false":
        opts = ["Verdadeiro", "Falso"]
    ans = str(q.get("answer") or "").strip()
    if ans not in opts:
        return None
    out["options"], out["answer"] = opts, ans
    return out


async def generate_image(description: str) -> str | None:
    """Nano Banana (Gemini image) → saved PNG; returns its /api/files URL or None."""
    try:
        chat = LlmChat(api_key=os.environ.get("EMERGENT_LLM_KEY", ""), session_id=str(uuid.uuid4()),
                       system_message="Você cria ilustrações educacionais claras para questões escolares.")
        chat.with_model("gemini", IMAGE_MODEL).with_params(modalities=["image", "text"])
        prompt = (f"Crie uma imagem educacional didática, estilo infográfico limpo, fundo branco, cores vivas, rótulos legíveis "
                  f"e curtos em português do Brasil, sem texto desnecessário. Conteúdo: {description}")
        _, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
        if not images:
            return None
        img = images[0]
        ext = "jpg" if "jpeg" in img.get("mime_type", "") else "png"
        return save_bytes(base64.b64decode(img["data"]), ext, prefix="ai-")
    except Exception as exc:
        logger.error("image generation failed: %s", exc)
        return None


async def _with_images(qs: list[dict]) -> list[dict]:
    async def one(q: dict) -> dict | None:
        desc = q.pop("image_prompt", "")
        if not desc:
            return q
        url = await generate_image(desc)
        if not url:
            return None  # the statement depends on the image — drop it
        q["image_url"] = url
        return q
    return [q for q in await asyncio.gather(*[one(q) for q in qs]) if q]


async def _batch(prompt: str, images: bool = False) -> list[dict]:
    try:
        data = parse_json(await complete(QUESTION_SYSTEM, prompt))
        qs = [v for v in (_valid(q) for q in data.get("questions", [])) if v]
    except Exception as exc:  # one failed batch should not sink the whole quiz
        logger.error("question batch failed: %s", exc)
        return []
    if images:
        return await _with_images(qs)
    for q in qs:
        q.pop("image_prompt", None)
    return qs


async def generate_curriculum_questions(topic: dict, grade_label: str, n: int, types: str | None = None,
                                        images: bool = True) -> list[dict]:
    mix = types or ("Misture os tipos: maioria multiple_choice, e inclua true_false, complete e association.")
    sizes = [5] * (n // 5) + ([n % 5] if n % 5 else [])
    prompts = [
        f"Crie {s} questões inéditas para {grade_label}, disciplina {topic['subject']}, {topic['bimestre']}º bimestre do "
        f"Currículo Paulista. Unidade temática: {topic['unidade']}. Habilidade: {topic['habilidade']}. "
        f"Objeto de conhecimento: {topic['objeto']}. {mix} Varie o nível de dificuldade (lote {i + 1}). {QUESTION_FORMAT}"
        f"{IMAGE_RULE if images and s >= 3 else ' image_prompt sempre vazio.'}"
        for i, s in enumerate(sizes)
    ]
    results = await asyncio.gather(*[_batch(p, images) for p in prompts])
    return [q for r in results for q in r]


async def generate_enem_questions(area_label: str, n: int) -> list[dict]:
    sizes = [5] * (n // 5) + ([n % 5] if n % 5 else [])
    prompts = [
        f"Crie {s} questões no estilo das provas anteriores do ENEM (INEP) para a área {area_label}. Cada questão deve ter "
        f"texto-base contextualizado (situação-problema, trecho, dado ou gráfico descrito) dentro do enunciado e 5 alternativas "
        f"(type multiple_choice, options com 5 itens iniciando por 'A) ', 'B) ' etc). Cubra competências variadas (lote {i + 1}). "
        f"{QUESTION_FORMAT} Aqui todas devem ser multiple_choice com 5 opções e image_prompt vazio."
        for i, s in enumerate(sizes)
    ]
    results = await asyncio.gather(*[_batch(p) for p in prompts])
    return [q for r in results for q in r]


ESSAY_SYSTEM = (
    "Você é corretor experiente da redação do ENEM. Avalie pelas 5 competências oficiais (0 a 200 cada, múltiplos de 40). "
    "Seja justo, didático e encorajador, em português do Brasil. Responda SOMENTE com JSON."
)


async def correct_essay(tema: str, texto: str) -> dict:
    prompt = (
        f"Tema: {tema}\n\nRedação:\n{texto}\n\nRetorne JSON: {{\"competencias\": [{{\"numero\": 1, \"nome\": \"...\", "
        f"\"nota\": 160, \"comentario\": \"...\"}} (5 itens)], \"comentario_geral\": \"...\", \"sugestoes\": [\"...\"]}}"
    )
    data = parse_json(await complete(ESSAY_SYSTEM, prompt))
    comps = [
        {"numero": int(c.get("numero", i + 1)), "nome": str(c.get("nome", "")),
         "nota": max(0, min(200, int(c.get("nota", 0)))), "comentario": str(c.get("comentario", ""))}
        for i, c in enumerate(data.get("competencias", [])[:5])
    ]
    return {"competencias": comps, "nota_total": sum(c["nota"] for c in comps),
            "comentario_geral": str(data.get("comentario_geral", "")),
            "sugestoes": [str(s) for s in data.get("sugestoes", [])][:6]}


TUTOR_MODES = {
    "explicar": "Explique o conteúdo de forma clara, com exemplos do cotidiano e passo a passo.",
    "duvida": "Responda a dúvida do estudante de forma direta e didática, verificando a compreensão ao final.",
    "questoes": "Crie 3 questões de treino (com gabarito comentado ao final) sobre o tema.",
    "resumir": "Resuma o texto enviado em tópicos curtos, destacando as ideias principais.",
    "mapa_mental": "Gere um mapa mental em formato de lista hierárquica (markdown com '-' e indentação), com o tema central no topo.",
    "plano": "Monte um plano de estudos semanal prático e motivador, com metas diárias curtas.",
}


def tutor_system(grade_label: str, mode: str, name: str) -> str:
    return (
        "Você é o Milton I.A Tutor, assistente educacional de uma escola estadual de São Paulo, alinhado ao Currículo "
        "Paulista (SEDUC-SP) e à BNCC. Fale em português do Brasil, com linguagem acolhedora e adequada a um estudante do "
        f"{grade_label}. O estudante se chama {name}. Use markdown simples (títulos ##, listas, **negrito**). "
        "Seja conciso (até ~250 palavras, salvo quando pedirem mais). Incentive o raciocínio, nunca dê só a resposta pronta "
        "em atividades avaliativas. Recuse temas impróprios para a escola. "
        f"Modo atual: {TUTOR_MODES.get(mode, TUTOR_MODES['duvida'])}"
    )
