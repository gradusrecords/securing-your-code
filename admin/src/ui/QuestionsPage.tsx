import { useEffect, useState } from 'react';
import { answerQuestion, listQuestions, type AdminQuestion } from '../api/questions';

export function QuestionsPage() {
  const [items, setItems] = useState<AdminQuestion[] | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState<Record<string, string>>({});

  useEffect(() => { listQuestions().then(setItems).catch((e: Error) => setError(e.message)); }, []);

  const send = async (q: AdminQuestion) => {
    const a = (text[q.question_id] ?? '').trim();
    if (!a) { setError('Введите ответ'); return; }
    setError('');
    try {
      await answerQuestion(q.question_id, a);
      setItems((all) => all?.map((x) => (x.question_id === q.question_id ? { ...x, answer: a, answered_at: new Date().toISOString() } : x)) ?? all);
    } catch (e) { setError((e as Error).message); }
  };

  const sorted = [...(items ?? [])].sort((a, b) => Number(!!a.answer) - Number(!!b.answer));

  return (
    <section>
      <h2>Вопросы</h2>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {sorted.map((q) => (
        <div key={q.question_id} className="row" data-testid={`question-${q.question_id}`}>
          <div className="grow">
            <b>{q.author_name ?? '—'}</b> <span className="tag">{q.author_role === 'model' ? 'модель' : 'бизнес'}</span>
            <div>{q.body}</div>
            {q.answer ? <div className="muted">Ответ: {q.answer}</div> : null}
          </div>
          {!q.answer ? (
            <>
              <textarea data-testid={`text-${q.question_id}`} value={text[q.question_id] ?? ''} placeholder="Ответ"
                onChange={(e) => setText((t) => ({ ...t, [q.question_id]: e.target.value }))} />
              <button data-testid={`answer-${q.question_id}`} onClick={() => send(q)}>Ответить</button>
            </>
          ) : null}
        </div>
      ))}
    </section>
  );
}
