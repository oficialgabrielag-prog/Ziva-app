/**
 * MarkdownText — renderizador de markdown nativo para React Native.
 * Suporta: H1/H2/H3, negrito, itálico, código inline, blocos de código,
 * listas com marcadores, listas numeradas, tabelas, blockquotes, separadores.
 * Não requer dependências externas.
 */
import React from 'react';
import { View, Text, ScrollView } from 'react-native';

// ─── Tipos de bloco ───────────────────────────────────────────────────────────
type MdBlock =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'hr' }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: Array<{ n: number; text: string }> }
  | { type: 'paragraph'; text: string };

// ─── Parser ──────────────────────────────────────────────────────────────────
function parse(md: string): MdBlock[] {
  const lines = md.split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bloco de código cercado ```
    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // pular a linha de fecho
      blocks.push({ type: 'code', lang, text: codeLines.join('\n') });
      continue;
    }

    // Separador
    if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Título H3
    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim() });
      i++;
      continue;
    }

    // Título H2
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3).trim() });
      i++;
      continue;
    }

    // Título H1
    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.slice(2).trim() });
      i++;
      continue;
    }

    // Tabela — detectar linha com pipe
    if (line.includes('|') && i + 1 < lines.length && /^\|?[\s:-]+\|/.test(lines[i + 1])) {
      const headers = line.split('|').map((c) => c.trim()).filter(Boolean);
      i += 2; // pular cabeçalho + separador
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').map((c) => c.trim()).filter(Boolean));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bqLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: 'blockquote', lines: bqLines });
      continue;
    }

    // Lista com marcadores
    if (/^[-*+] /.test(line.trimStart())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+] /.test(lines[i].trimStart())) {
        items.push(lines[i].replace(/^[-*+] /, '').trimStart());
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Lista numerada
    if (/^\d+\. /.test(line.trimStart())) {
      const items: Array<{ n: number; text: string }> = [];
      while (i < lines.length && /^\d+\. /.test(lines[i].trimStart())) {
        const m = lines[i].match(/^(\d+)\. (.*)/);
        if (m) items.push({ n: parseInt(m[1], 10), text: m[2] });
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Linha vazia — ignora
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Parágrafo — acumula linhas consecutivas não-especiais
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('> ') &&
      !/^[-*+] /.test(lines[i].trimStart()) &&
      !/^\d+\. /.test(lines[i].trimStart()) &&
      !lines[i].trimStart().startsWith('```') &&
      !lines[i].includes('|')
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join('\n') });
    }
  }

  return blocks;
}

// ─── Renderizador inline (negrito, itálico, código) ──────────────────────────
interface InlineProps {
  text: string;
  baseColor: string;
  fontSize?: number;
  lineHeight?: number;
}

function InlineText({ text, baseColor, fontSize = 15, lineHeight = 23 }: InlineProps) {
  // Divide o texto nos marcadores inline: **bold**, *italic*, `code`
  const parts = splitInline(text);
  return (
    <Text style={{ fontSize, lineHeight, color: baseColor, flexShrink: 1 }}>
      {parts.map((p, idx) => {
        if (p.type === 'bold') {
          return (
            <Text key={idx} style={{ fontWeight: '800', color: baseColor }}>
              {p.text}
            </Text>
          );
        }
        if (p.type === 'italic') {
          return (
            <Text key={idx} style={{ fontStyle: 'italic', color: baseColor }}>
              {p.text}
            </Text>
          );
        }
        if (p.type === 'code') {
          return (
            <Text
              key={idx}
              style={{
                fontFamily: 'monospace',
                fontSize: fontSize - 1,
                color: '#C4B5FD',
                backgroundColor: 'rgba(123,63,242,0.15)',
                paddingHorizontal: 4,
                borderRadius: 4,
              }}
            >
              {p.text}
            </Text>
          );
        }
        return (
          <Text key={idx} style={{ color: baseColor }}>
            {p.text}
          </Text>
        );
      })}
    </Text>
  );
}

type InlinePart = { type: 'text' | 'bold' | 'italic' | 'code'; text: string };

function splitInline(text: string): InlinePart[] {
  // Ordem: code > bold > italic
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  const parts: InlinePart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', text: text.slice(last, m.index) });
    }
    const matched = m[0];
    if (matched.startsWith('`')) {
      parts.push({ type: 'code', text: matched.slice(1, -1) });
    } else if (matched.startsWith('**')) {
      parts.push({ type: 'bold', text: matched.slice(2, -2) });
    } else {
      parts.push({ type: 'italic', text: matched.slice(1, -1) });
    }
    last = m.index + matched.length;
  }
  if (last < text.length) {
    parts.push({ type: 'text', text: text.slice(last) });
  }
  return parts.length ? parts : [{ type: 'text', text }];
}

// ─── Renderizador de bloco ────────────────────────────────────────────────────
function renderBlock(block: MdBlock, idx: number, textColor: string) {
  switch (block.type) {
    case 'h1':
      return (
        <View key={idx} style={{ marginTop: 16, marginBottom: 6 }}>
          <InlineText text={block.text} baseColor={textColor} fontSize={20} lineHeight={28} />
          <View style={{ height: 1.5, backgroundColor: 'rgba(123,63,242,0.4)', marginTop: 6, borderRadius: 1 }} />
        </View>
      );

    case 'h2':
      return (
        <View key={idx} style={{ marginTop: 14, marginBottom: 5 }}>
          <InlineText text={block.text} baseColor={textColor} fontSize={17} lineHeight={24} />
        </View>
      );

    case 'h3':
      return (
        <View key={idx} style={{ marginTop: 10, marginBottom: 4 }}>
          <InlineText text={block.text} baseColor={textColor} fontSize={15} lineHeight={22} />
        </View>
      );

    case 'hr':
      return (
        <View
          key={idx}
          style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 10, borderRadius: 1 }}
        />
      );

    case 'blockquote':
      return (
        <View
          key={idx}
          style={{
            borderLeftWidth: 3, borderLeftColor: '#7B3FF2',
            paddingLeft: 12, marginVertical: 6,
            backgroundColor: 'rgba(123,63,242,0.08)',
            borderRadius: 4, paddingVertical: 8,
          }}
        >
          {block.lines.map((line, li) => (
            <InlineText
              key={li}
              text={line}
              baseColor="rgba(196,181,253,0.9)"
              fontSize={14}
              lineHeight={21}
            />
          ))}
        </View>
      );

    case 'code':
      return (
        <View
          key={idx}
          style={{
            backgroundColor: '#0F0F1A',
            borderRadius: 10,
            padding: 14,
            marginVertical: 8,
            borderWidth: 1,
            borderColor: 'rgba(123,63,242,0.25)',
            overflow: 'hidden',
          }}
        >
          {block.lang ? (
            <Text
              style={{
                fontSize: 10, fontWeight: '700', color: '#7B3FF2',
                letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase',
              }}
            >
              {block.lang}
            </Text>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text
              style={{
                fontFamily: 'monospace', fontSize: 13, color: '#E2E8F0', lineHeight: 20,
              }}
            >
              {block.text}
            </Text>
          </ScrollView>
        </View>
      );

    case 'table': {
      const colCount = Math.max(block.headers.length, ...block.rows.map((r) => r.length));
      return (
        <ScrollView key={idx} horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
          <View style={{ borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Cabeçalho */}
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(123,63,242,0.2)' }}>
              {Array.from({ length: colCount }).map((_, ci) => (
                <View
                  key={ci}
                  style={{
                    minWidth: 90, paddingHorizontal: 12, paddingVertical: 9,
                    borderRightWidth: ci < colCount - 1 ? 1 : 0,
                    borderRightColor: 'rgba(123,63,242,0.3)',
                  }}
                >
                  <Text style={{ color: '#C4B5FD', fontWeight: '800', fontSize: 12 }}>
                    {block.headers[ci] ?? ''}
                  </Text>
                </View>
              ))}
            </View>
            {/* Linhas */}
            {block.rows.map((row, ri) => (
              <View
                key={ri}
                style={{
                  flexDirection: 'row',
                  borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
                  backgroundColor: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)',
                }}
              >
                {Array.from({ length: colCount }).map((_, ci) => (
                  <View
                    key={ci}
                    style={{
                      minWidth: 90, paddingHorizontal: 12, paddingVertical: 8,
                      borderRightWidth: ci < colCount - 1 ? 1 : 0,
                      borderRightColor: 'rgba(255,255,255,0.07)',
                    }}
                  >
                    <Text style={{ color: textColor, fontSize: 13, lineHeight: 19 }}>
                      {row[ci] ?? ''}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    }

    case 'ul':
      return (
        <View key={idx} style={{ marginVertical: 4, gap: 4, paddingLeft: 4 }}>
          {block.items.map((item, ii) => (
            <View key={ii} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Text style={{ color: '#7B3FF2', fontSize: 16, lineHeight: 22, marginTop: 1 }}>•</Text>
              <View style={{ flex: 1 }}>
                <InlineText text={item} baseColor={textColor} fontSize={14} lineHeight={22} />
              </View>
            </View>
          ))}
        </View>
      );

    case 'ol':
      return (
        <View key={idx} style={{ marginVertical: 4, gap: 4, paddingLeft: 4 }}>
          {block.items.map((item, ii) => (
            <View key={ii} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Text style={{ color: '#7B3FF2', fontSize: 13, lineHeight: 22, fontWeight: '700', minWidth: 22 }}>
                {item.n}.
              </Text>
              <View style={{ flex: 1 }}>
                <InlineText text={item.text} baseColor={textColor} fontSize={14} lineHeight={22} />
              </View>
            </View>
          ))}
        </View>
      );

    case 'paragraph':
      return (
        <View key={idx} style={{ marginVertical: 3 }}>
          <InlineText text={block.text} baseColor={textColor} fontSize={15} lineHeight={23} />
        </View>
      );

    default:
      return null;
  }
}

// ─── Componente exportado ─────────────────────────────────────────────────────
interface MarkdownTextProps {
  content: string;
  color?: string;
}

export function MarkdownText({ content, color = '#F9FAFB' }: MarkdownTextProps) {
  const blocks = React.useMemo(() => parse(content), [content]);
  return (
    <View style={{ gap: 1 }}>
      {blocks.map((block, idx) => renderBlock(block, idx, color))}
    </View>
  );
}
