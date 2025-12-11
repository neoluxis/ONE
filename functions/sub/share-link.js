import getParsedSubData from "../internal/getParsedSubData.ts";
import { ShareLinkDumper } from "../internal/Dumpers/share-link.js";

export async function onRequest (context, isBase64 = false) {
    const { request } = context;
    const URLObject = new URL(request.url);
    // do convert
    let { Proxies } = await getParsedSubData(
        URLObject.searchParams.get("url"), 
        context.env.EdgeSubDB, 
        URLObject.searchParams.get("show_host") === "true",
        JSON.parse(URLObject.searchParams.get("http_headers")),
    );
    // filter proxies by keywords if provided. keywords are slash-separated.
    const filterKeywordRaw = URLObject.searchParams.get("filter_keyword") || "";
    if (filterKeywordRaw.trim().length > 0) {
        const keywords = filterKeywordRaw.split("/").map(k => k.trim()).filter(k => !!k).map(k => k.toLowerCase());
        if (keywords.length > 0) {
            Proxies = Proxies.filter(p => {
                try {
                    const name = (p.__Remark || "").toString().toLowerCase();
                    const source = (p.__Source || "").toString().toLowerCase();
                    const host = ((p.Hostname || "") + ":" + (p.Port || "")).toString().toLowerCase();
                    for (let kw of keywords) {
                        if (kw.length === 0) continue;
                        if (name.includes(kw) || source.includes(kw) || host.includes(kw)) {
                            return false; // exclude this proxy
                        }
                    }
                } catch (e) {
                    return true;
                }
                return true;
            })
        }
    }
    let Dumper = new ShareLinkDumper();
    let ShareLinkArray = [];
    for (let i of Proxies) {
        if (Dumper[i.__Type]) {
            ShareLinkArray.push(Dumper[i.__Type](i))
        }
    }
    
    // generate final response
    let ShareLinkResponse = ShareLinkArray.join("\n");
    if (isBase64 === true) {
        ShareLinkResponse = btoa(ShareLinkResponse);
    }

    return new Response(ShareLinkResponse, {
        status: 200,
        headers: {
            "Content-Type": "text/plain, charset=utf-8",
            "Content-Length": ShareLinkResponse.length
        }
    })
}
