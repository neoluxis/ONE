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
    // filter proxies by regex pattern if provided. pattern uses pipe-separated alternatives (e.g., pattern1|pattern2)
    const filterKeywordRaw = URLObject.searchParams.get("filter_keyword") || "";
    if (filterKeywordRaw.trim().length > 0) {
        try {
            const filterRegex = new RegExp(filterKeywordRaw, "i"); // case-insensitive regex
            Proxies = Proxies.filter(p => {
                try {
                    const name = (p.__Remark || "").toString();
                    const source = (p.__Source || "").toString();
                    const host = ((p.Hostname || "") + ":" + (p.Port || "")).toString();
                    // exclude if any field matches the regex pattern
                    if (filterRegex.test(name) || filterRegex.test(source) || filterRegex.test(host)) {
                        return false; // exclude this proxy
                    }
                } catch (e) {
                    return true;
                }
                return true;
            })
        } catch (e) {
            console.warn("[share-link filter] Invalid regex pattern:", filterKeywordRaw, e);
            // if regex is invalid, keep all proxies
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
