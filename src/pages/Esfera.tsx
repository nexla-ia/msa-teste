import ProgramaFidelidadeGenerico from '../components/ProgramaFidelidadeGenerico';

export default function Esfera() {
  return (
    <ProgramaFidelidadeGenerico
      config={{
        nome: 'Esfera',
        tabela: 'esfera_membros',
        temStatusPrograma: true
      }}
    />
  );
}
