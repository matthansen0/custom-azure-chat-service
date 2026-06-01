import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function MembersPanel({ members, userId }) {
    const online = members.filter((m) => m.presence === "online");
    const offline = members.filter((m) => m.presence !== "online");
    return (_jsxs("div", { className: "members-panel", children: [_jsx("h3", { className: "members-panel__title", children: "Members" }), online.length > 0 && (_jsxs("div", { className: "members-panel__section", children: [_jsxs("div", { className: "members-panel__section-label", children: ["Online \u2014 ", online.length] }), online.map((member) => (_jsx(MemberRow, { member: member, isYou: member.id === userId }, member.id)))] })), offline.length > 0 && (_jsxs("div", { className: "members-panel__section", children: [_jsxs("div", { className: "members-panel__section-label", children: ["Offline \u2014 ", offline.length] }), offline.map((member) => (_jsx(MemberRow, { member: member, isYou: member.id === userId }, member.id)))] }))] }));
}
function MemberRow({ member, isYou }) {
    return (_jsxs("div", { className: "member-row", children: [_jsxs("div", { className: "member-row__avatar", children: [_jsx("span", { children: member.displayName.charAt(0).toUpperCase() }), _jsx("div", { className: `member-row__status ${member.presence}` })] }), _jsxs("div", { className: "member-row__info", children: [_jsxs("span", { className: "member-row__name", children: [member.displayName, isYou && _jsx("span", { className: "member-row__you", children: " (you)" })] }), member.attributes?.team && (_jsx("span", { className: "member-row__team", children: member.attributes.team }))] })] }));
}
