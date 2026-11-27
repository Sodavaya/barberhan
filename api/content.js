const crypto = require("crypto");
const db = require("../_db");
const defaults = require("../content-default.json");
const same = (a,b) => { const x=Buffer.from(String(a)), y=Buffer.from(String(b)); return x.length===y.length && crypto.timingSafeEqual(x,y); };
module.exports = async (req,res) => {
  res.setHeader("Cache-Control","no-store");
  try {
    if (req.method === "GET") {
      const raw = await db(["GET","site:content"]);
      let data = defaults;
      if (raw) { try { data = Object.assign({}, defaults, JSON.parse(raw)); } catch (_) {} }
      return res.status(200).json(data);
    }
    if (req.method !== "POST") return res.status(405).end();
    const b=req.body||{};
    const ip=String((req.headers["x-forwarded-for"]||"").split(",")[0]||"x").trim();
    const fk="cmsfail:"+ip;
    if ((Number(await db(["GET",fk]))||0)>=10) return res.status(429).json({error:"locked"});
    if (!process.env.ADMIN_PASSWORD || !same(b.password||"",process.env.ADMIN_PASSWORD)) {
      await db(["INCR",fk]); await db(["EXPIRE",fk,"900"]);
      return res.status(401).json({error:"auth"});
    }
    await db(["DEL",fk]);
    const d=b.data;
    if (Buffer.byteLength(JSON.stringify(d||{}),"utf8")>3500000) return res.status(413).json({error:"too_large"});
    if (!d || typeof d!=="object" || Array.isArray(d)) return res.status(400).json({error:"data"});
    const clean={
      settings:{
        phone:String(d.settings?.phone||"").slice(0,30),
        whatsapp:String(d.settings?.whatsapp||"").slice(0,30),
        address:String(d.settings?.address||"").slice(0,250),
        hours:String(d.settings?.hours||"").slice(0,120)
      },
      hero:{
        badge:String(d.hero?.badge||"").slice(0,180),
        title:String(d.hero?.title||"").slice(0,80),
        subtitle:String(d.hero?.subtitle||"").slice(0,120),
        description:String(d.hero?.description||"").slice(0,500)
      },
      services:Array.isArray(d.services)?d.services.slice(0,100).map(x=>({
        category:String(x.category||"Услуги").slice(0,80),
        name:String(x.name||"").slice(0,100),
        description:String(x.description||"").slice(0,240),
        price:Math.max(0,Math.min(100000,Number(x.price)||0)),
        duration:Math.max(0,Math.min(600,Number(x.duration)||0))
      })).filter(x=>x.name):[],
      barbers:Array.isArray(d.barbers)?d.barbers.slice(0,30).map(x=>({
        name:String(x.name||"").slice(0,80), role:String(x.role||"Барбер").slice(0,80),
        bio:String(x.bio||"").slice(0,400), photo:/^https:\/\/|^data:image\/(jpeg|png|webp);base64,/i.test(String(x.photo||""))?String(x.photo).slice(0,1500000):""
      })).filter(x=>x.name):[],
      gallery:Array.isArray(d.gallery)?d.gallery.slice(0,60).map(x=>({
        url:String(x.url||"").slice(0,700000), caption:String(x.caption||"").slice(0,120)
      })).filter(x=>/^https:\/\/|^data:image\/(jpeg|png|webp);base64,/i.test(x.url)):[]
    };
    await db(["SET","site:content",JSON.stringify(clean)]);
    return res.status(200).json({ok:true});
  } catch(e) { return res.status(500).json({error:"server"}); }
};
