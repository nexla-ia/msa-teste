import ProgramaFidelidadeGenerico from '../components/ProgramaFidelidadeGenerico';

export default function Pagol() {
  return (
    <ProgramaFidelidadeGenerico
      config={{
        nome: 'Pagol',
        tabela: 'pagol_membros',
        temStatusPrograma: true
      }}
    />
  );
}
