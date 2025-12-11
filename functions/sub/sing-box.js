import { getSingBoxConfig } from "../internal/Converter/getSingBoxConfig.ts";
import getParsedSubData from "../internal/getParsedSubData.ts";

export async function onRequest (context) {
    const { request } = context;
    const URLObject = new URL(request.url);
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

    // a javascript object !!! not YAML !!!
    let SingBoxConfigObject = await getSingBoxConfig (
        Proxies,
        context.env.EdgeSubDB,
        {
            isUDP: URLObject.searchParams.get("udp") === "true",
            isSSUoT: URLObject.searchParams.get("ss_uot") === "true",
            isInsecure: true,
            RuleProvider: URLObject.searchParams.get("remote_config") || "__DEFAULT",
            RuleProvidersProxy: URLObject.searchParams.get("rule_providers_proxy"),
            isForcedRefresh: URLObject.searchParams.get("forced_refresh") === "true" ? true : false
        }
    )

    // handle forced ws 0-rtt
    if (URLObject.searchParams.get("forced_ws0rtt") === "true") {
        console.info("[Main] ForcedWS0RTT enabled.")
        for (let i of SingBoxConfigObject.outbounds) {
            if (!("transport" in i)) {
                continue;
            }
            if (i.transport.type !== "ws") {
                continue;
            }
            i.transport.max_early_data = 2560
            i.transport.early_data_header_name = "Sec-WebSocket-Protocol"
        }
    }

    const ResponseBody = JSON.stringify(SingBoxConfigObject)

    return new Response(ResponseBody, {
        status: 200,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": ResponseBody.length,
        }
    })
}