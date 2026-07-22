import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, FlatList, Pressable,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Modal, Linking, StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ShoppingBag, Plus, Search, X, ChevronRight,
  MapPin, MessageCircle, Tag, Package, Flame,
  Check, Camera, Trash2,
} from 'lucide-react-native';
import { supabase } from '@/client/supabase';
import { useSession } from '@/ctx';
import { useZivaTheme } from '@/lib/theme-context';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  category: string;
  images: string[];
  contact_whatsapp: string | null;
  contact_email: string | null;
  location: string | null;
  is_available: boolean;
  views: number;
  created_at: string;
  profiles?: { username: string; avatar_url: string | null; is_verified: boolean };
}

const CATEGORIES = [
  { key: 'todos',       label: 'Todos',       emoji: '🌍' },
  { key: 'moda',        label: 'Moda',        emoji: '👗' },
  { key: 'eletronicos', label: 'Eletrónicos', emoji: '📱' },
  { key: 'casa',        label: 'Casa',        emoji: '🏠' },
  { key: 'veiculos',    label: 'Veículos',    emoji: '🚗' },
  { key: 'alimentos',   label: 'Alimentação', emoji: '🍎' },
  { key: 'servicos',    label: 'Serviços',    emoji: '🛠️' },
  { key: 'arte',        label: 'Arte',        emoji: '🎨' },
  { key: 'musica',      label: 'Música',      emoji: '🎵' },
  { key: 'geral',       label: 'Geral',       emoji: '📦' },
];

const CURRENCIES = ['AOA', 'USD', 'EUR', 'ZAR'];

function formatPrice(price: number, currency: string) {
  if (currency === 'AOA') return `${price.toLocaleString('pt-AO')} Kz`;
  if (currency === 'USD') return `$${price.toLocaleString('en-US')}`;
  if (currency === 'EUR') return `€${price.toLocaleString('pt-PT')}`;
  return `${price.toLocaleString()} ${currency}`;
}

// ─── Card do produto ──────────────────────────────────────────────────────────
function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const { colors } = useZivaTheme();
  const img = product.images?.[0];
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: '48%', backgroundColor: colors.card,
        borderRadius: 16, overflow: 'hidden', marginBottom: 12,
        borderWidth: 0.5, borderColor: colors.cardBorder,
      }}
    >
      {img ? (
        <Image source={{ uri: img }} style={{ width: '100%', height: 140 }} contentFit="cover" />
      ) : (
        <View style={{ width: '100%', height: 140, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center' }}>
          <Package size={40} color={colors.muted} />
        </View>
      )}
      <View style={{ padding: 10, gap: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }} numberOfLines={2}>{product.title}</Text>
        <Text style={{ fontSize: 15, fontWeight: '900', color: '#7B3FF2' }}>
          {formatPrice(product.price, product.currency)}
        </Text>
        {product.location && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <MapPin size={10} color={colors.muted} />
            <Text style={{ fontSize: 10, color: colors.muted }} numberOfLines={1}>{product.location}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          {product.profiles?.avatar_url ? (
            <Image source={{ uri: product.profiles.avatar_url }} style={{ width: 18, height: 18, borderRadius: 9 }} contentFit="cover" />
          ) : (
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#7B3FF2', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                {(product.profiles?.username ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: 10, color: colors.muted }} numberOfLines={1}>@{product.profiles?.username ?? '—'}</Text>
          {product.profiles?.is_verified && <Text style={{ fontSize: 10 }}>✓</Text>}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Modal de detalhe do produto ──────────────────────────────────────────────
function ProductDetailModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { colors } = useZivaTheme();
  const [imgIdx, setImgIdx] = useState(0);
  const imgs = product.images ?? [];

  const contactWhatsapp = () => {
    if (product.contact_whatsapp) {
      const msg = encodeURIComponent(`Olá! Vi o teu produto "${product.title}" no Marketplace Ziva. Ainda está disponível?`);
      Linking.openURL(`https://wa.me/${product.contact_whatsapp.replace(/\D/g, '')}?text=${msg}`);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            {/* Imagem principal */}
            <View style={{ position: 'relative' }}>
              {imgs.length > 0 ? (
                <Image source={{ uri: imgs[imgIdx] }} style={{ width: '100%', height: 280, borderTopLeftRadius: 24, borderTopRightRadius: 24 }} contentFit="cover" />
              ) : (
                <View style={{ width: '100%', height: 280, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                  <Package size={60} color={colors.muted} />
                </View>
              )}
              <Pressable onPress={onClose} style={{ position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color="#fff" />
              </Pressable>
              {imgs.length > 1 && (
                <View style={{ position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                  {imgs.map((_, i) => (
                    <Pressable key={i} onPress={() => setImgIdx(i)} style={{ width: i === imgIdx ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === imgIdx ? '#fff' : 'rgba(255,255,255,0.5)' }} />
                  ))}
                </View>
              )}
            </View>

            <View style={{ padding: 20, gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, flex: 1 }}>{product.title}</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#7B3FF2', marginLeft: 8 }}>{formatPrice(product.price, product.currency)}</Text>
              </View>

              {/* Categoria + localização */}
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {(() => { const cat = CATEGORIES.find(c => c.key === product.category); return cat ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(123,63,242,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 13 }}>{cat.emoji}</Text>
                    <Text style={{ fontSize: 12, color: '#7B3FF2', fontWeight: '600' }}>{cat.label}</Text>
                  </View>
                ) : null; })()}
                {product.location && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.input, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <MapPin size={12} color={colors.muted} />
                    <Text style={{ fontSize: 12, color: colors.muted }}>{product.location}</Text>
                  </View>
                )}
              </View>

              {/* Vendedor */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: colors.card, borderRadius: 12, borderWidth: 0.5, borderColor: colors.cardBorder }}>
                {product.profiles?.avatar_url ? (
                  <Image source={{ uri: product.profiles.avatar_url }} style={{ width: 42, height: 42, borderRadius: 21 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#7B3FF2', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{(product.profiles?.username ?? '?').charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>@{product.profiles?.username ?? '—'}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Vendedor</Text>
                </View>
                {product.profiles?.is_verified && <Check size={16} color="#7B3FF2" />}
              </View>

              {/* Descrição */}
              {product.description && (
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Descrição</Text>
                  <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 20 }}>{product.description}</Text>
                </View>
              )}

              {/* Contactar */}
              {product.contact_whatsapp && (
                <Pressable onPress={contactWhatsapp} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#25D366', borderRadius: 14, paddingVertical: 14 }}>
                  <MessageCircle size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Contactar pelo WhatsApp</Text>
                </Pressable>
              )}
              {product.contact_email && !product.contact_whatsapp && (
                <Pressable onPress={() => Linking.openURL(`mailto:${product.contact_email}`)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7B3FF2', borderRadius: 14, paddingVertical: 14 }}>
                  <MessageCircle size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Enviar e-mail</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal de adicionar produto ───────────────────────────────────────────────
function AddProductModal({ userId, onClose, onAdded }: { userId: string; onClose: () => void; onAdded: () => void }) {
  const { colors } = useZivaTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('AOA');
  const [category, setCategory] = useState('geral');
  const [location, setLocation] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setError('Permissão negada para aceder à galeria'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: 5 });
    if (r.canceled) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const asset of r.assets) {
        const ext = asset.uri.split('.').pop() ?? 'jpg';
        const path = `marketplace/${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const blob = await (await fetch(asset.uri)).blob();
        const { error: upErr } = await supabase.storage.from('ziva_images').upload(path, blob, { contentType: `image/${ext}` });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('ziva_images').getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      setImages((prev) => [...prev, ...uploaded].slice(0, 5));
    } catch (e: any) {
      setError(e.message ?? 'Erro ao carregar imagem');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) { setError('Sessão expirada. Volta a entrar na aplicação.'); return; }
    if (!title.trim()) { setError('O título é obrigatório'); return; }
    const priceNum = parseFloat(price.replace(',', '.'));
    if (isNaN(priceNum) || priceNum < 0) { setError('Preço inválido'); return; }
    setSaving(true); setError('');
    try {
      const { error: insErr } = await supabase.from('marketplace_products').insert({
        user_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        price: priceNum,
        currency,
        category,
        images,
        location: location.trim() || null,
        contact_whatsapp: whatsapp.trim() || null,
      });
      if (insErr) throw insErr;
      onAdded();
      onClose();
    } catch (e: any) {
      // Traduz mensagens técnicas do Supabase para português legível
      const raw: string = e.message ?? '';
      const friendlyMsg = raw.includes('row-level security')
        ? 'Sem permissão para publicar. Verifica a tua sessão e tenta novamente.'
        : raw.includes('violates foreign key')
        ? 'Conta inválida. Volta a entrar na aplicação.'
        : raw || 'Erro ao publicar produto. Tenta novamente.';
      setError(friendlyMsg);
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable style={{ ...StyleSheet.absoluteFillObject }} onPress={onClose} />
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '94%' }}>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Anunciar Produto</Text>
                <Pressable onPress={onClose}>
                  <X size={22} color={colors.muted} />
                </Pressable>
              </View>

              {/* Imagens */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>FOTOS ({images.length}/5)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {images.map((uri, i) => (
                    <View key={i} style={{ position: 'relative' }}>
                      <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 10 }} contentFit="cover" />
                      <Pressable onPress={() => setImages(prev => prev.filter((_, j) => j !== i))}
                        style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={11} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                  {images.length < 5 && (
                    <Pressable onPress={pickImage} disabled={uploading}
                      style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: colors.input, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      {uploading ? <ActivityIndicator size="small" color="#7B3FF2" /> : (
                        <>
                          <Camera size={22} color={colors.muted} />
                          <Text style={{ fontSize: 10, color: colors.muted, fontWeight: '600' }}>Adicionar</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </ScrollView>
              </View>

              {/* Título */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>TÍTULO *</Text>
                <TextInput value={title} onChangeText={setTitle} placeholder="Ex: iPhone 14 Pro Max 256GB" placeholderTextColor={colors.muted}
                  style={{ backgroundColor: colors.input, color: colors.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 0.5, borderColor: colors.border }} />
              </View>

              {/* Descrição */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>DESCRIÇÃO</Text>
                <TextInput value={description} onChangeText={setDescription} placeholder="Descreve o produto, estado, detalhes..." placeholderTextColor={colors.muted} multiline numberOfLines={3}
                  style={{ backgroundColor: colors.input, color: colors.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, borderWidth: 0.5, borderColor: colors.border, textAlignVertical: 'top', minHeight: 80 }} />
              </View>

              {/* Preço + moeda */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>PREÇO *</Text>
                  <TextInput value={price} onChangeText={setPrice} placeholder="0" placeholderTextColor={colors.muted} keyboardType="numeric"
                    style={{ backgroundColor: colors.input, color: colors.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 0.5, borderColor: colors.border }} />
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>MOEDA</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {CURRENCIES.map((c) => (
                      <Pressable key={c} onPress={() => setCurrency(c)}
                        style={{ paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12, backgroundColor: currency === c ? '#7B3FF2' : colors.input, borderWidth: 0.5, borderColor: currency === c ? '#7B3FF2' : colors.border }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: currency === c ? '#fff' : colors.muted }}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {/* Categoria */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>CATEGORIA</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {CATEGORIES.filter(c => c.key !== 'todos').map((cat) => (
                    <Pressable key={cat.key} onPress={() => setCategory(cat.key)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: category === cat.key ? '#7B3FF2' : colors.input, borderWidth: 0.5, borderColor: category === cat.key ? '#7B3FF2' : colors.border }}>
                      <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: category === cat.key ? '#fff' : colors.muted }}>{cat.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Localização */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>LOCALIZAÇÃO</Text>
                <TextInput value={location} onChangeText={setLocation} placeholder="Ex: Luanda, Angola" placeholderTextColor={colors.muted}
                  style={{ backgroundColor: colors.input, color: colors.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, borderWidth: 0.5, borderColor: colors.border }} />
              </View>

              {/* WhatsApp */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>WHATSAPP (para contacto)</Text>
                <TextInput value={whatsapp} onChangeText={setWhatsapp} placeholder="+244 9XX XXX XXX" placeholderTextColor={colors.muted} keyboardType="phone-pad"
                  style={{ backgroundColor: colors.input, color: colors.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, borderWidth: 0.5, borderColor: colors.border }} />
              </View>

              {error ? <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>{error}</Text> : null}

              <Pressable onPress={handleSave} disabled={saving}
                style={{ backgroundColor: '#7B3FF2', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 }}>
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Publicar Produto 🚀</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Ecrã principal do Marketplace ───────────────────────────────────────────
export default function MarketplaceScreen() {
  const { session } = useSession();
  const { colors } = useZivaTheme();
  const insets = useSafeAreaInsets();
  const userId = session?.user?.id ?? '';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('todos');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const loadedRef = useRef(false);

  const loadProducts = useCallback(async (cat = activeCategory, q = query) => {
    setLoading(true);
    try {
      let dbQuery = supabase
        .from('marketplace_products')
        .select('*, profiles(username, avatar_url, is_verified)')
        .eq('is_available', true)
        .order('created_at', { ascending: false })
        .limit(60);

      if (cat !== 'todos') dbQuery = dbQuery.eq('category', cat);
      if (q.trim()) dbQuery = dbQuery.ilike('title', `%${q.trim()}%`);

      const { data } = await dbQuery;
      setProducts((data ?? []) as Product[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCategory, query]);

  useFocusEffect(useCallback(() => {
    loadProducts(activeCategory, query);
  }, [loadProducts, activeCategory, query]));

  const handleRefresh = () => {
    setRefreshing(true);
    loadProducts(activeCategory, query);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ── Header ── */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: colors.bg, borderBottomWidth: 0.5, borderBottomColor: colors.cardBorder }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={22} color="#7B3FF2" />
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>Marketplace</Text>
            <View style={{ backgroundColor: 'rgba(123,63,242,0.15)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#7B3FF2' }}>MUNDIAL 🌍</Text>
            </View>
          </View>
          <Pressable onPress={() => setShowAdd(true)}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#7B3FF2', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Pesquisa */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.input, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 0.5, borderColor: colors.border }}>
          <Search size={15} color={colors.muted} />
          <TextInput value={query} onChangeText={(t) => { setQuery(t); loadProducts(activeCategory, t); }}
            placeholder="Pesquisar produtos..." placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.text, fontSize: 14 }} returnKeyType="search" />
          {query ? <Pressable onPress={() => { setQuery(''); loadProducts(activeCategory, ''); }}><X size={15} color={colors.muted} /></Pressable> : null}
        </View>

        {/* Categorias */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
          {CATEGORIES.map((cat) => (
            <Pressable key={cat.key} onPress={() => { setActiveCategory(cat.key); loadProducts(cat.key, query); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: activeCategory === cat.key ? '#7B3FF2' : colors.input, borderWidth: 0.5, borderColor: activeCategory === cat.key ? '#7B3FF2' : colors.border }}>
              <Text style={{ fontSize: 13 }}>{cat.emoji}</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: activeCategory === cat.key ? '#fff' : colors.muted }}>{cat.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── Lista de produtos ── */}
      {loading && products.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color="#7B3FF2" />
          <Text style={{ color: colors.muted, fontSize: 14 }}>A carregar produtos...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
          <Package size={56} color={colors.muted} />
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' }}>Nenhum produto encontrado</Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center' }}>Sê o primeiro a anunciar um produto no Marketplace Ziva!</Text>
          <Pressable onPress={() => setShowAdd(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#7B3FF2', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24 }}>
            <Plus size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Anunciar Produto</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 12, gap: 0, paddingBottom: insets.bottom + 16 }}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentInsetAdjustmentBehavior="automatic"
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => setSelected(item)} />
          )}
          ListFooterComponent={
            <Pressable onPress={() => setShowAdd(true)}
              style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(123,63,242,0.12)', borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(123,63,242,0.3)' }}>
              <Plus size={18} color="#7B3FF2" />
              <Text style={{ color: '#7B3FF2', fontSize: 15, fontWeight: '800' }}>Anunciar o teu produto</Text>
            </Pressable>
          }
        />
      )}

      {/* Modais */}
      {selected && <ProductDetailModal product={selected} onClose={() => setSelected(null)} />}
      {showAdd && <AddProductModal userId={userId} onClose={() => setShowAdd(false)} onAdded={() => loadProducts(activeCategory, query)} />}
    </View>
  );
}
