import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const state = [];
let cursor = 0;
const jsx = (type, props) => ({type, props: props || {}});
const react = {
  useState(initial) {
    const slot = cursor++;
    if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
    return [state[slot], value => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }];
  },
  useRef: () => ({current:null}),
  useEffect: () => {},
};
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), {
  compilerOptions: {module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX},
}).outputText;
const dates = {};
new Function('exports', compile('src/lib/calendar.ts'))(dates);
const module = {};
new Function('exports','require', compile('src/pages/Calendar.tsx'))(module, name => {
  if (name === 'react') return react;
  if (name === 'react/jsx-runtime') return {jsx,jsxs:jsx,Fragment:'fragment'};
  if (name.endsWith('/calendar')) return dates;
  if (name.endsWith('/roles')) return {canAccess:()=>true};
  if (name.endsWith('/authContext')) return {useAuth:()=>({user:{id:'test'}})};
  if (name === 'lucide-react') return new Proxy({}, {get:(_,key)=>key});
  return {};
});
const render = () => { cursor=0; return module.Calendar({hideHeader:true,eventsData:[],onEventFormOpen:()=>{},onSpecificationOpen:()=>{}}); };
function find(node, match) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const child of node) { const found=find(child,match);if(found)return found; } return; }
  if (match(node)) return node;
  return find(node.props?.children,match);
}
const label = name => node=>node.props['aria-label']===name;
const dialog = tree => find(tree,node=>node.props.role==='dialog' && node.props['aria-label']==='Выбор месяца и года');
let tree=render();
find(tree,node=>node.props['aria-haspopup']==='dialog').props.onClick();
tree=render();assert(dialog(tree));
find(tree,label('Следующий год')).props.onClick();tree=render();assert(dialog(tree));
find(tree,label('Предыдущий год')).props.onClick();tree=render();assert(dialog(tree));
for (const text of ['День','Неделя','2 недели','Месяц']) {
  find(tree,node=>node.type==='button' && node.props.children===text).props.onClick();
  tree=render();assert(dialog(tree),`${text} must not dismiss the picker`);
}
find(tree,node=>node.type==='button' && String(node.props['aria-label']||'').startsWith('Декабрь ')).props.onClick();
tree=render();assert(dialog(tree),'choosing a month must not dismiss the picker');
find(tree,node=>node.type==='button' && node.props.children==='Готово').props.onClick();
assert.equal(dialog(render()),undefined);
console.log('PASS: picker remains open for year, view and month changes; Done closes explicitly');
