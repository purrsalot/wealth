import type { TrendItem, GeneratedHooks } from '../types';

export function generateViralHooks(trend: TrendItem, tone: 'casual' | 'controversial' | 'professional' = 'casual'): GeneratedHooks {
  const { title, summary, hashtags, relatedKeywords, category } = trend;

  if (tone === 'controversial') {
    return {
      tiktokHooks: [
        {
          audioVisualHook: `(Tatap kamera tegas) "Banyak orang salah paham soal ${title}. Ini alasan kenapa 90% orang gagal ikutan tren ini!"`,
          textOnScreen: `⛔ JANGAN IKUTAN ${title.toUpperCase()} SEBELUM NONTON INI!`,
          scriptAngle: `Buka dengan poin kontra-intuitif. Jelaskan risiko atau kesalahan umum saat mencoba ${relatedKeywords[0] || title}, baru berikan solusinya di akhir.`
        },
        {
          audioVisualHook: `(Tunjukkan grafik/data di layar) "Kenapa gak ada yang ngomongin hal ini? ${title} itu sebenarnya..."`,
          textOnScreen: `⚠️ Rahasia yang disembunyiin di balik ${relatedKeywords[1] || 'tren ini'}`,
          scriptAngle: `Bongkar data unik. Bandingkan modal vs potensi hasil dalam 30 detik.`
        },
        {
          audioVisualHook: `(Tunjuk text on screen) "Kalo kamu masih mikir ${title} itu susah, fix kamu ketinggalan jaman."`,
          textOnScreen: `💸 Kenapa ${title} bisa bikin orang dapet cuan cepat?`,
          scriptAngle: `Tunjukkan contoh konkret keberhasilan seseorang dalam bidang ini.`
        }
      ],
      twitterThread: [
        `🧵 1/6 Kebanyakan orang salah paham tentang "${title}".\n\nPadahal kalau kamu paham celahnya, ini bisa jadi tambang emas di 2026.\n\nIni breakdown lengkap & rahasianya 👇`,
        `2/6 Apa itu ${title}?\n\nSecara singkat: ${summary}`,
        `3/6 Kenapa ini lagi meledak sekarang?\n- Pencarian naik ${trend.growthRate}\n- Keyword populer: ${relatedKeywords.slice(0, 3).join(', ')}\n- Target pasar: ${trend.targetAudience}`,
        `4/6 Langkah taktis buat mulai hari ini:\n1. Pelajari ${relatedKeywords[0] || 'dasarnya'}\n2. Manfaatkan tools otomatisasi\n3. Konsisten bangun portofolio`,
        `5/6 Potensi Monetisasi:\n${category === 'crypto' || category === 'business' ? 'Buka konsultasi / produk digital / affiliate.' : 'Bikin konten edukasi + jualan produk rekomendasi.'}`,
        `6/6 Suka breakdown trend kaya gini? Retweet tweet pertama & follow buat insight harian! 🚀\n\n${hashtags.join(' ')}`
      ],
      youtubeAngle: {
        title: `RAHASIA TERSEMBUNYI: ${title} (${trend.growthRate} Growth Rate!)`,
        thumbnailIdea: `Muka kaget dengan background grafik merah melonjak dan teks raksasa: "${relatedKeywords[0]?.toUpperCase() || 'CUAN BANYAK?'}"`,
        keyPoints: [
          `Latar belakang meledaknya ${title}`,
          `3 Kesalahan fatal pemula`,
          `Step-by-step eksekusi dalam 1 hari`,
          `Proyeksi tren 6 bulan ke depan`
        ]
      },
      monetizationIdea: `Jual E-book / Template Guide seharga Rp 49.000 - Rp 99.000 tentang "${title}" atau buat Komunitas Telegram Premium.`
    };
  }

  if (tone === 'professional') {
    return {
      tiktokHooks: [
        {
          audioVisualHook: `(Penampilan rapi, senyum) "Analisis data minggu ini menunjukkan tren ${title} naik sebesar ${trend.growthRate}. Ini artinya buat bisnis kamu..."`,
          textOnScreen: `📈 Trend Analysis: ${title}`,
          scriptAngle: `Sampaikan data rasional dan dampak strategis untuk profesional/pebisnis.`
        },
        {
          audioVisualHook: `(Tunjukkan slide presentation) "3 Alasan kenapa industri ${category.toUpperCase()} saat ini terfokus pada ${title}."`,
          textOnScreen: `💡 ${title}: Market Insight 2026`,
          scriptAngle: `Fokus pada efisiensi kerja, return on investment, dan opportunity cost.`
        },
        {
          audioVisualHook: `(Pointing gesture) "Bagaimana cara memanfaatkan ${title} untuk meningkatkan produktivitas kamu hingga 3x lipat."`,
          textOnScreen: `🚀 How to leverage ${title}`,
          scriptAngle: `Tutorial singkat 3 langkah praktis.`
        }
      ],
      twitterThread: [
        `🧵 1/5 Market Insight & Trend Analysis: "${title}" (${trend.growthRate} Growth).\n\nBerikut analisis komprehensif mengapa topik ini mendominasi industri saat ini:`,
        `2/5 Summary singkat:\n${summary}`,
        `3/5 Key Takeaways:\n• Target Segmen: ${trend.targetAudience}\n• Search Demand: ${trend.searchVolume}\n• High-intent Keywords: ${relatedKeywords.join(', ')}`,
        `4/5 Action Plan untuk Profesional & Creator:\nAdopsi teknologi/framework ini sebelum menjadi jenuh di pasaran.`,
        `5/5 Dapatkan laporan tren industri mingguan dengan bookmark thread ini! 📊\n\n${hashtags.slice(0, 3).join(' ')}`
      ],
      youtubeAngle: {
        title: `Panduan Lengkap Memahami ${title} [Masterclass 2026]`,
        thumbnailIdea: `Layout clean ala Bloomberg/Forbes, tulisan "MARKET ANALYSIS 2026" dengan foto grafik tumbuh.`,
        keyPoints: [
          `Latar belakang industri & data statistik`,
          `Analisis studi kasus & implikasi bisnis`,
          `Framework implementasi langsung`
        ]
      },
      monetizationIdea: `Buka layanan Jasa Konsultasi / Custom Agency Solution dengan tiket Rp 500k - Rp 2jt per sesi.`
    };
  }

  // Default: Casual Tone
  return {
    tiktokHooks: [
      {
        audioVisualHook: `(Muka kaget sambil nunjuk layar HP) "Woi, kalian udah tau belum kalau ${title} lagi rame banget?"`,
        textOnScreen: `😱 TREN BARU VIRAL: ${title.toUpperCase()}!`,
        scriptAngle: `Ceritakan dengan gaya santai seolah lagi gosip bareng temen di kafe.`
      },
      {
        audioVisualHook: `(Sambil ngetik di laptop/HP) "Sumpah ini seru banget! Aku baru nyobain ${relatedKeywords[0] || title} dan hasilnya..."`,
        textOnScreen: `🔥 Nyobain ${title} yang lagi viral`,
        scriptAngle: `Review jujur & pengalaman pribadi menggunakan atau mengikuti tren ini.`
      },
      {
        audioVisualHook: `(Teks heboh) "Nyesel banget baru tau ${title} sekarang, padahal caranya gampang..."`,
        textOnScreen: `✨ Hack Cepat ${title}`,
        scriptAngle: `Beri tips & trick simpel 15 detik.`
      }
    ],
    twitterThread: [
      `🧵 1/5 Lagi rame banget dibahas: "${title}"!\n\nBuat yang belum tahu, ini rangkuman singkat kenapa semua orang lagi ngomongin ini 👇`,
      `2/5 Intinya begini: ${summary}`,
      `3/5 Kenapa ini penting buat kamu?\nKarena keyword kaya "${relatedKeywords.slice(0, 2).join('", "')}" penelusurannya lagi naik pesat ${trend.growthRate}!`,
      `4/5 Tips mulai cobain:\nGak perlu ribet, mulai dari hal terkecil dulu dan konsisten.`,
      `5/5 Retweet kalau konten ini bermanfaat ya! Save biar gak lupa 😉\n\n${hashtags.join(' ')}`
    ],
    youtubeAngle: {
        title: `COBAIN TREN VIRAL: ${title} (Ternyata Cuan Banget?!)`,
        thumbnailIdea: `Foto ekspresi gembira/heran nunjuk logo platform (${trend.platform}) dengan emoji api 🔥`,
        keyPoints: [
          `Pengenalan tren yang lagi viral`,
          `Live trial / pembuktian langsung`,
          `Kesimpulan worth it atau enggak`
        ]
    },
    monetizationIdea: `Pasang Affiliate Link produk terkait di bio TikTok/Instagram & dapet komisi dari pembeli.`
  };
}
